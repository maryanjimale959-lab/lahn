import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { CACHE_DIR, tools } from './config.js';
import { log } from './log.js';

mkdirSync(CACHE_DIR, { recursive: true });

const CAP_BYTES = 1.5 * 1024 ** 3;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 90000;
/* A three-minute song and a three-hour talk are not the same fetch: give the long ones room
   in proportion to their length, but never so much that a dead video hangs a tap forever. */
const timeoutFor = (seconds) => Math.min(300000, TIMEOUT_MS + Math.max(0, Number(seconds) || 0) * 20);
const ID = /^[\w-]{6,40}$/;

const inFlight = new Map();

const extOf = (videoId) => readdirSync(CACHE_DIR).find((f) => f.startsWith(`${videoId}.`)) ?? null;

/** Cached, not kept: shelves play straight through, and this folder is pruned to stay small. */
export function cachedFile(videoId) {
  if (!ID.test(String(videoId ?? ''))) return null;
  const name = extOf(videoId);
  if (!name) return null;
  const file = path.join(CACHE_DIR, name);
  try {
    return statSync(file).size > 1024 ? file : null;
  } catch {
    return null;
  }
}

function prune() {
  const rows = readdirSync(CACHE_DIR)
    .map((name) => {
      const file = path.join(CACHE_DIR, name);
      try {
        const s = statSync(file);
        return s.isFile() ? { file, size: s.size, at: s.mtimeMs } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);

  let total = rows.reduce((sum, row) => sum + row.size, 0);
  const deadline = Date.now() - MAX_AGE_MS;
  for (const row of rows) {
    if (row.at > deadline && total < CAP_BYTES) break;
    try {
      unlinkSync(row.file);
      total -= row.size;
    } catch {
      /* a second play may have taken it already */
    }
  }
}

function fetchAudio(url, target, duration) {
  return new Promise((resolve, reject) => {
    const t = tools();
    if (!t.ytDlp) return reject(new Error('yt-dlp is missing'));
    const args = [
      ...(t.ffmpeg ? ['--ffmpeg-location', path.dirname(t.ffmpeg)] : []),
      '--no-playlist', '--no-warnings', '--socket-timeout', '20', '--retries', '2',
      /* YouTube serves m4a audio for most videos, so this is a remux rather than a transcode. */
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-x', '--audio-format', 'm4a',
      '--no-mtime', '--no-simulate',
      '-o', `${target}.%(ext)s`,
      url,
    ];
    const child = spawn(t.ytDlp, args, { cwd: CACHE_DIR, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (chunk) => {
      err = (err + chunk.toString()).slice(-4000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutFor(duration));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(Object.assign(new Error(err.trim().split('\n').pop() || `yt-dlp exited with code ${code}`), { code: 'STREAM_FAILED' }));
    });
  });
}

/**
 * Make a shelf item playable without adding it to the library. Resolves to a file the
 * caller streams with Range support, so the scrub bar works like any saved song.
 */
export async function ensurePlayable(item) {
  if (!item?.id || !item.url) throw Object.assign(new Error('Nothing to play'), { code: 'NO_ITEM' });
  const hit = cachedFile(item.id);
  if (hit) return hit;
  if (inFlight.has(item.id)) return inFlight.get(item.id);

  const target = path.join(CACHE_DIR, item.id);
  const work = fetchAudio(item.url, target, item.duration)
    .catch((err) => {
      /* YouTube signs the media addresses it hands out, and a signature that expires
         mid-download looks exactly like a refusal. One more run re-asks for them, which
         is what most of these 403s need; a video that is really blocked is not worth
         holding a tap for. */
      if (!/403|Forbidden|timed? ?out|temporarily/i.test(String(err.message ?? ''))) throw err;
      return fetchAudio(item.url, target, item.duration);
    })
    .then(() => {
      const file = cachedFile(item.id);
      if (!file) throw Object.assign(new Error('No audio came back'), { code: 'STREAM_FAILED' });
      prune();
      return file;
    })
    .finally(() => inFlight.delete(item.id));

  inFlight.set(item.id, work);
  return work;
}

export const mimeFor = (file) => (path.extname(file).toLowerCase() === '.mp3' ? 'audio/mpeg' : 'audio/mp4');

/**
 * A licensed item is already a file on somebody's CDN, so there is nothing to convert: pass the
 * byte range straight through and carry the answer back. Going through this server rather than
 * pointing the browser at the CDN is what keeps the phone working when the host next door
 * serves its audio without a cross-origin header, and keeps one origin for the whole app.
 */
export async function streamRemote(req, res, url) {
  const target = new URL(url);
  const abort = new AbortController();
  const stop = () => abort.abort(new Error('the listener moved on'));
  req.on('close', stop);
  res.on('close', stop);

  let upstream;
  try {
    upstream = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; Laxan/0.1; personal music app)',
        ...(req.headers.range ? { range: req.headers.range } : {}),
      },
      redirect: 'follow',
      signal: abort.signal,
    });
  } catch (err) {
    req.off('close', stop);
    throw Object.assign(new Error(`${target.host} would not answer: ${err.message}`), { code: 'STREAM_FAILED' });
  }

  if (!upstream.ok && upstream.status !== 206) {
    req.off('close', stop);
    abort.abort(new Error('gone'));
    throw Object.assign(new Error(`${target.host} answered ${upstream.status} for that episode.`), { code: 'STREAM_FAILED' });
  }

  const forward = ['content-length', 'content-range', 'content-type', 'accept-ranges'];
  const headers = { 'cache-control': 'private, max-age=86400', 'accept-ranges': 'bytes' };
  for (const name of forward) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  if (!headers['content-type']?.startsWith('audio')) headers['content-type'] = 'audio/mpeg';

  res.writeHead(upstream.status, headers);
  if (req.method === 'HEAD' || !upstream.body) {
    req.off('close', stop);
    return res.end();
  }

  const source = Readable.fromWeb(upstream.body, { highWaterMark: 256 * 1024 });
  source.on('error', (err) => {
    log.warn('remote stream broke:', err.message);
    res.destroy();
  });
  source.on('close', () => req.off('close', stop));
  source.pipe(res);
}

export { CACHE_DIR };
