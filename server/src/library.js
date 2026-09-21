import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { AUDIO_EXTENSIONS, COVERS_DIR, LIBRARY_DIR, tools } from './config.js';
import { all, findOrCreateAlbum, findOrCreateArtist, get, newId, now, run } from './db.js';
import { log } from './log.js';
import { download, fetchBinary, probe, tidyTitle } from './ytdlp.js';

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function safeName(input, fallback = 'Untitled') {
  let out = String(input ?? '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  if (!out) out = fallback;
  if (RESERVED.test(out.split('.')[0])) out = `_${out}`;
  return out.slice(0, 160);
}

function relPath(absolute) {
  return path.relative(LIBRARY_DIR, absolute).split(path.sep).join('/');
}

export function absolutePath(stored) {
  return path.isAbsolute(stored) ? stored : path.join(LIBRARY_DIR, stored);
}

function readTags(file) {
  const ffprobe = tools().ffprobe;
  if (!ffprobe) return Promise.resolve(null);
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(ffprobe, ['-v', 'quiet', '-print_format', 'json', '-show_format', file], { windowsHide: true });
    child.stdout.on('data', (c) => (out += c));
    child.on('error', () => resolve(null));
    child.on('close', () => {
      try {
        const json = JSON.parse(out);
        const tags = json.format?.tags ?? {};
        resolve({
          title: tags.title ?? null,
          artist: tags.artist ?? tags.album_artist ?? null,
          album: tags.album ?? null,
          duration: Number(json.format?.duration ?? 0) || 0,
          year: tags.date ? Number(String(tags.date).slice(0, 4)) || null : null,
        });
      } catch {
        resolve(null);
      }
    });
  });
}

export function ensureLibraryDirs() {
  mkdirSync(LIBRARY_DIR, { recursive: true });
  mkdirSync(COVERS_DIR, { recursive: true });
}

/**
 * Files copied in by hand usually carry their artwork inside the tag. Pull it out
 * so the library grids show covers instead of generated fallbacks.
 */
function extractCover(file, stored) {
  const bin = tools().ffmpeg;
  if (!bin) return null;
  const hash = createHash('sha1').update(stored).digest('hex').slice(0, 16);
  const storedCover = `covers/scan-${hash}.jpg`;
  const out = path.join(LIBRARY_DIR, storedCover);
  if (existsSync(out)) return storedCover;
  const made = spawnSync(bin, ['-y', '-v', 'error', '-i', file, '-map', '0:v', '-frames:v', '1', '-vf', 'scale=640:-2', out], {
    windowsHide: true,
  });
  if (made.status !== 0 || !existsSync(out) || statSync(out).size < 512) {
    rmSync(out, { force: true });
    return null;
  }
  return storedCover;
}

export function insertTrack({ title, artistName, albumTitle, duration, storedPath, size, cover, sourceUrl, sourceId, year }) {
  const artist = findOrCreateArtist(artistName);
  const album = findOrCreateAlbum(albumTitle || 'Singles', artist.id, year);
  const id = newId();
  run(
    `INSERT INTO tracks (id, title, artist_id, album_id, duration, path, size, cover, source_url, source_id, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    safeName(title),
    artist.id,
    album.id,
    Number(duration) || 0,
    storedPath,
    Number(size) || 0,
    cover,
    sourceUrl ?? null,
    sourceId ?? null,
    now()
  );
  if (!album.image) {
    run('UPDATE albums SET image = ? WHERE id = ?', cover, album.id);
  }
  if (!artist.image) {
    run('UPDATE artists SET image = ? WHERE id = ?', cover, artist.id);
  }
  return trackById(id);
}

export const TRACK_SELECT = `
  SELECT t.*, a.name AS artist, al.title AS album
  FROM tracks t
  LEFT JOIN artists a ON a.id = t.artist_id
  LEFT JOIN albums al ON al.id = t.album_id
`;

export function trackById(id) {
  return get(`${TRACK_SELECT} WHERE t.id = ?`, id);
}

export async function ingest(url, { onStage } = {}, signal) {
  ensureLibraryDirs();
  onStage?.({ stage: 'probing', message: 'Reading the link…' });
  const meta = await probe(url);
  if (meta.isLive) throw new Error('That is a live stream, not a song. Pick a normal video.');
  if (!meta.duration) throw new Error('That video has no playable audio length.');

  const artistFolder = safeName(meta.artist, 'Unknown artist');
  const base = safeName(meta.title);
  const id = newId();

  onStage?.({ stage: 'downloading', message: `Downloading ${meta.title}`, meta });
  const ext = await download(
    url,
    { root: LIBRARY_DIR, subdir: artistFolder, filename: base },
    (p) => onStage?.({ stage: 'downloading', percent: p.percent, bytes: p.bytes, total: p.total, speed: p.speed, eta: p.eta, meta }),
    signal
  );

  const stored = relPath(path.resolve(LIBRARY_DIR, `${artistFolder}/${base}.${ext}`));

  for (const orphan of ['.webp', '.jpg', '.jpeg', '.png']) {
    const leftover = path.resolve(LIBRARY_DIR, `${artistFolder}/${base}${orphan}`);
    if (existsSync(leftover)) rmSync(leftover, { force: true });
  }

  if (get('SELECT id FROM tracks WHERE path = ?', stored)) {
    throw Object.assign(new Error('That song is already in your library.'), { code: 'DUPLICATE' });
  }

  let cover = null;
  if (meta.thumbnail) {
    try {
      const buf = await fetchBinary(meta.thumbnail, signal);
      const file = `covers/${id}.jpg`;
      writeFileSync(path.join(LIBRARY_DIR, file), buf);
      cover = file;
    } catch (err) {
      log.warn('cover art skipped:', err.message);
    }
  }

  const size = existsSync(absolutePath(stored)) ? statSync(absolutePath(stored)).size : 0;
  onStage?.({ stage: 'saving', message: 'Adding to your library…', meta });

  const track = insertTrack({
    title: meta.title,
    artistName: meta.artist,
    albumTitle: meta.album,
    duration: meta.duration,
    storedPath: stored,
    size,
    cover,
    sourceUrl: meta.webpageUrl || url,
    sourceId: meta.sourceId,
    year: meta.year,
  });

  return track;
}

export async function scanLibrary() {
  ensureLibraryDirs();
  const known = new Set(all('SELECT path FROM tracks').map((r) => r.path));
  let added = 0;

  const walk = async (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'covers') continue;
        walk(full);
      } else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const stored = relPath(full);
        if (known.has(stored)) continue;
        const size = statSync(full).size;
        const tags = (await readTags(full)) ?? {};
        const artistName = tags.artist || (dir === LIBRARY_DIR ? 'Unknown artist' : path.basename(dir));
        insertTrack({
          /* A tag copied straight off YouTube reads "Bôa - Duvet (Official Video)"; the shelf
             should show the song, not the upload. */
          title: tidyTitle(tags.title || path.basename(stored, path.extname(stored)), artistName),
          artistName,
          albumTitle: tags.album,
          duration: tags.duration || 0,
          storedPath: stored,
          size,
          cover: extractCover(full, stored),
          sourceUrl: null,
          sourceId: null,
          year: tags.year,
        });
        added += 1;
      }
    }
  };

  await walk(LIBRARY_DIR);
  return { added };
}

export function pruneOrphans() {
  run('DELETE FROM playlist_items WHERE track_id NOT IN (SELECT id FROM tracks)');
  // Artists and albums only exist because a file carried them, so an empty one is a ghost.
  for (const row of all('SELECT id FROM artists WHERE id NOT IN (SELECT artist_id FROM tracks)')) {
    run('DELETE FROM albums WHERE artist_id = ?', row.id);
    run('DELETE FROM artists WHERE id = ?', row.id);
  }
  for (const row of all('SELECT id FROM albums WHERE id NOT IN (SELECT album_id FROM tracks)')) {
    run('DELETE FROM albums WHERE id = ?', row.id);
  }
}

export function pruneMissing() {
  const removed = [];
  for (const row of all('SELECT id, path FROM tracks')) {
    if (!existsSync(absolutePath(row.path))) {
      run('DELETE FROM tracks WHERE id = ?', row.id);
      removed.push(row.id);
    }
  }
  if (removed.length) pruneOrphans();
  return { removed: removed.length };
}
