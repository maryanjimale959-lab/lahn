import { spawn } from 'node:child_process';
import path from 'node:path';
import { tools } from './config.js';

export class ToolMissing extends Error {
  constructor(name) {
    super(`Laxan couldn't find ${name} on this computer.`);
    this.code = 'TOOL_MISSING';
    this.tool = name;
  }
}

function need(bin, label) {
  if (!bin) throw new ToolMissing(label);
  return bin;
}

function runTool(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      windowsHide: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out = [];
    const errs = [];
    /* Chunks are stitched as bytes: a UTF-8 sequence split across two reads would
       otherwise land as a replacement character in the middle of a title. */
    child.stdout.on('data', (chunk) => {
      out.push(chunk);
      opts.onStdout?.(chunk.toString());
    });
    child.stderr.on('data', (chunk) => {
      errs.push(chunk);
      opts.onStderr?.(chunk.toString());
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const stdout = Buffer.concat(out).toString('utf8');
      const stderr = Buffer.concat(errs).toString('utf8');
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(stderr.trim().split('\n').pop() || `${bin} exited with code ${code}`), { stdout, stderr, code }));
    });
    opts.onSpawn?.(child);
  });
}

const BASE_ARGS = ['--no-playlist', '--no-warnings', '--socket-timeout', '20', '--retries', '3'];

export async function probe(url, kind = 'song') {
  const yt = need(tools().ytDlp, 'yt-dlp');
  const { stdout } = await runTool(yt, [...BASE_ARGS, '--dump-single-json', '--skip-download', url]);
  const info = JSON.parse(stdout);
  return normalizeInfo(info, kind);
}

function first(...values) {
  for (const v of values) if (v != null && String(v).trim()) return String(v).trim();
  return null;
}

/* YouTube titles carry upload noise — "(Official Video) [4K Remaster]" — and often repeat the
   artist. Anything in brackets survives only when it changes which recording the song is. */
const KEEP_IN_BRACKETS = /\b(feat\.?|ft\.?|with|remix|edit|mix|live|acoustic|instrumental|demo|part\s?\d+)\b/i;
const NOISE_TAIL = /\s*[-–—|:]?\b(?:official|music|lyrics?|videos?|audios?|mv|m\/v|visualizer|trailer|preview|audio\s?version|hd|hq|[48]k|remastered?|vevo|full)\s*$/i;

export function tidyTitle(raw, artist = null) {
  let t = String(raw ?? '').replace(/\s+/g, ' ').trim();
  t = t.replace(/[[(]([^\][)]{0,80})[\])]/g, (_m, inner) => (KEEP_IN_BRACKETS.test(inner) ? ` (${inner.trim()})` : ' '));
  if (artist) {
    const a = String(artist).trim();
    const lead = a && t.length > a.length ? t.slice(a.length) : '';
    const sep = lead.match(/^\s*[-–—|:]\s*/);
    if (sep && t.slice(0, a.length).toLowerCase() === a.toLowerCase()) t = t.slice(a.length + sep[0].length);
  }
  let before;
  do {
    before = t;
    const trimmed = t.replace(NOISE_TAIL, '');
    if (trimmed.trim()) t = trimmed;
  } while (t !== before);
  t = t.replace(/\s{2,}/g, ' ').replace(/(?:\s|\(|\[|-|–|—|\|)+$/, '').trim();
  return t || String(raw ?? '').trim() || 'Untitled';
}

/**
 * YouTube rarely fills in the artist tag, so the channel name lands there instead — which
 * files "NAPA - Deslocado" under the curator's channel. When the title itself carries an
 * "Artist - Track" prefix and nothing was credited, trust the title.
 */
function creditTitle(rawTitle, credited, channel) {
  if (credited || !channel || !rawTitle) return { artist: credited ?? channel ?? 'Unknown artist', title: rawTitle };
  const split = rawTitle.match(/^([^-\u2013\u2014|]{2,48}?)\s*[-\u2013\u2014|]\s+(.+)$/);
  if (!split || /^\s*(official|live|audio|video|full|lyrics?|mv|m\/v|cover)\b/i.test(split[1])) {
    return { artist: channel, title: rawTitle };
  }
  return { artist: split[1].trim(), title: split[2].trim() };
}

function normalizeInfo(info, kind = 'song') {
  const credited = first(info.artist);
  const channel = first(info.uploader, info.channel, info.creator);
  const raw = first(info.title);
  /* The "Artist - Track" split and the "(Official Video) [4K]" cleanup exist because song
     uploads are titled after the recording. A lesson or episode *is* its title — stripping
     "Lesson 3 -" or "(Part 2)" would hide what she just saved it for. */
  const spoken = kind && kind !== 'song';
  const { artist, title } = spoken
    ? { artist: credited ?? channel ?? 'Unknown artist', title: raw }
    : creditTitle(raw, credited, channel);
  return {
    sourceId: first(info.id) ?? '',
    title: spoken ? title || 'Untitled' : tidyTitle(title, artist),
    artist,
    album: first(info.album, info.release_album) ?? null,
    duration: Number(info.duration ?? 0) || 0,
    year: info.year ? Number(info.year) : null,
    thumbnail: first(info.thumbnail, infothumbnailsFallback(info)) ?? null,
    uploaderId: first(info.channel_id, info.uploader_id) ?? null,
    webpageUrl: first(info.webpage_url, info.webpageURL) ?? null,
    isLive: Boolean(info.is_live) || Number(info.release_timestamp ?? 0) > Date.now() / 1000,
  };
}

function infothumbnailsFallback(info) {
  const list = Array.isArray(info.thumbnails) ? info.thumbnails : [];
  const best = list.filter((t) => t.width && t.height).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  return best?.url ?? list.at(-1)?.url ?? null;
}

const PROGRESS_PREFIX = 'LAHNPROGRESS|';
const EXT_PREFIX = 'LAHNEXT|';

/* yt-dlp writes plain text in the console's code page, so a printed "Bôa/Duvet.m4a" arrives as
   invalid UTF-8 and the library stores a path no file matches. Only the extension is read back
   from it — that is ASCII, and the rest of the name is one we chose ourselves. */
export function download(url, target, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const t = tools();
    let bin;
    try {
      bin = need(t.ytDlp, 'yt-dlp');
    } catch (err) {
      reject(err);
      return;
    }

    const args = [
      ...BASE_ARGS,
      ...(t.ffmpeg ? ['--ffmpeg-location', path.dirname(t.ffmpeg)] : []),
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-x',
      '--audio-format', 'm4a',
      '--audio-quality', '0',
      '--embed-thumbnail',
      '--embed-metadata',
      '--newline',
      '--no-mtime',
      '--progress-template',
      `download:${PROGRESS_PREFIX}%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s`,
      '--no-simulate',
      '--print',
      `after_move:${EXT_PREFIX}%(ext)s`,
      '-o',
      `${target.subdir.replace(/[\\/]+$/, '')}/${target.filename}.%(ext)s`,
      url,
    ];

    let child = null;
    let cancelled = false;
    const abort = () => {
      cancelled = true;
      child?.kill('SIGKILL');
    };
    signal?.addEventListener('abort', abort, { once: true });

    let tail = '';
    let extension = null;

    runTool(bin, args, {
      cwd: target.root,
      onSpawn: (c) => {
        child = c;
      },
      onStdout: (chunk) => {
        tail += chunk;
        const lines = tail.split(/\r?\n/);
        tail = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith(PROGRESS_PREFIX)) {
            const [, bytes, total, percent, speed, eta] = line.split('|');
            onProgress?.({
              bytes: Number(bytes) || 0,
              total: Number(total) || 0,
              percent: Number(String(percent).replace('%', '').trim()) || 0,
              speed: (speed || '').trim(),
              eta: (eta || '').trim(),
            });
          } else if (line.startsWith(EXT_PREFIX)) {
            extension = line.slice(EXT_PREFIX.length).trim();
          }
        }
      },
    })
      .then(() => {
        signal?.removeEventListener('abort', abort);
        if (cancelled) reject(Object.assign(new Error('Cancelled'), { code: 'CANCELLED' }));
        else if (!extension) reject(new Error('yt-dlp finished without reporting the saved file.'));
        else resolve(extension);
      })
      .catch((err) => {
        signal?.removeEventListener('abort', abort);
        if (cancelled) reject(Object.assign(new Error('Cancelled'), { code: 'CANCELLED' }));
        else reject(err);
      });
  });
}

export async function fetchBinary(url, signal) {
  const res = await fetch(url, { signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Laxan)' } });
  if (!res.ok) throw new Error(`Artwork download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 512) throw new Error('Artwork response was too small to be an image');
  return buf;
}

/* A channel list is read with --flat-playlist: no audio, no ffmpeg, just the titles YouTube
   already indexes. approximate_date gives each row a publish timestamp so the newest lands on top. */
export async function listUploads(url, { limit = 40 } = {}) {
  const yt = need(tools().ytDlp, 'yt-dlp');
  const { stdout } = await runTool(
    yt,
    [
      '--flat-playlist',
      '--extractor-args',
      'youtubetab:approximate_date',
      '--playlist-end',
      String(limit),
      '--no-warnings',
      '--socket-timeout',
      '25',
      '--retries',
      '2',
      '--dump-single-json',
      '--skip-download',
      url,
    ]
  );
  const info = JSON.parse(stdout);
  const rows = Array.isArray(info.entries) ? info.entries : [info];
  const entries = rows
    .map((e) => ({
      id: first(e.id) ?? '',
      title: (first(e.title) ?? 'Untitled').trim(),
      url: first(e.url, e.webpage_url) ?? (e.id ? `https://www.youtube.com/watch?v=${e.id}` : null),
      duration: Number(e.duration ?? 0) || 0,
      thumbnail: first(e.thumbnail, infothumbnailsFallback(e)) ?? null,
      /* Flat rows carry "timestamp"; only the full extractor calls it "release_timestamp". */
      uploadedAt: Number(e.timestamp ?? e.release_timestamp ?? 0) || null,
      isLive: Boolean(e.is_live) || e.live_status === 'is_live',
    }))
    .filter((e) => e.url)
    .sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));

  return {
    name: first(info.channel, info.uploader, info.title) ?? null,
    image: first(info.thumbnail, infothumbnailsFallback(info)) ?? null,
    entries,
  };
}
