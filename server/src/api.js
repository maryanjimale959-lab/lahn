import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { APP_VERSION, LIBRARY_DIR, PORT, tools } from './config.js';
import { all, get, isKind, newId, now, run, sortKey, stats, tx } from './db.js';
import { lanAddresses } from './net.js';
import { absolutePath, pruneMissing, pruneOrphans, scanLibrary, TRACK_SELECT, trackById } from './library.js';
import { cancel, createJob, getJob, isDuplicateUrl, listJobs, subscribe, unsubscribe } from './jobs.js';
import { addChannel, catalog, channelUploads, deleteChannel, listChannels, refreshAll, refreshChannel, shelves } from './channels.js';
import * as playback from './session.js';
import { log } from './log.js';

const MIME = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.mka': 'audio/x-matroska',
  '.aac': 'audio/aac',
};

export function createApi() {
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));

  router.get('/health', (_req, res) => {
    const t = tools();
    res.json({
      ok: true,
      version: APP_VERSION,
      name: 'Lahn',
      port: PORT,
      lan: lanAddresses(),
      libraryDir: LIBRARY_DIR,
      tools: { ytdlp: t.ytDlp, ffmpeg: t.ffmpeg, ffprobe: t.ffprobe },
      missing: [!t.ytDlp && 'yt-dlp', !t.ffmpeg && 'ffmpeg'].filter(Boolean),
      stats: stats(),
    });
  });

  const listTracks = (where = '', params = [], orderBy = 't.added_at DESC') =>
    all(`${TRACK_SELECT} ${where} ORDER BY ${orderBy}`, ...params);

  router.get('/tracks', (req, res) => {
    const clauses = [];
    const params = [];
    if (req.query.artist) {
      clauses.push('t.artist_id = ?');
      params.push(req.query.artist);
    }
    if (req.query.album) {
      clauses.push('t.album_id = ?');
      params.push(req.query.album);
    }
    if (isKind(req.query.kind)) {
      clauses.push('t.kind = ?');
      params.push(req.query.kind);
    }
    if (req.query.favourites) {
      clauses.push('t.favourite = 1');
    }
    const sort = { recent: 't.added_at DESC', title: 'LOWER(t.title) ASC', plays: 't.plays DESC, t.added_at DESC', artist: 'LOWER(a.name) ASC, LOWER(t.title) ASC' }[req.query.sort] || 't.added_at DESC';
    res.json({ tracks: listTracks(clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params, sort) });
  });

  router.get('/tracks/:id', (req, res) => {
    const track = trackById(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    res.json({ track });
  });

  router.post('/tracks/:id/play', (req, res) => {
    run('UPDATE tracks SET plays = plays + 1, last_played_at = ? WHERE id = ?', now(), req.params.id);
    res.json({ ok: true });
  });

  router.post('/tracks/:id/favourite', (req, res) => {
    const track = trackById(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    const next = req.body?.favourite ?? (track.favourite ? 0 : 1);
    run('UPDATE tracks SET favourite = ? WHERE id = ?', next ? 1 : 0, req.params.id);
    res.json({ track: trackById(req.params.id) });
  });

  router.delete('/tracks/:id', (req, res) => {
    const track = trackById(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    run('DELETE FROM tracks WHERE id = ?', req.params.id);
    pruneOrphans();
    res.json({ ok: true, keptOnDisk: true, path: track.path });
  });

  router.get('/tracks/:id/audio', (req, res) => {
    const track = get('SELECT * FROM tracks WHERE id = ?', req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    const file = absolutePath(track.path);
    if (!existsSync(file)) return res.status(410).json({ error: 'File is missing from the library folder' });
    streamFile(req, res, file, MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
  });

  router.get('/tracks/:id/cover', (req, res) => {
    const track = get('SELECT cover FROM tracks WHERE id = ?', req.params.id);
    const file = track?.cover ? absolutePath(track.cover) : null;
    if (!file || !existsSync(file)) return res.status(404).end();
    streamFile(req, res, file, 'image/jpeg');
  });

  router.get('/covers/:file', (req, res) => {
    const name = path.basename(req.params.file);
    if (!/^[\w.-]+\.(jpe?g|png|webp)$/i.test(name)) return res.status(400).end();
    const file = absolutePath(`covers/${name}`);
    if (!existsSync(file)) return res.status(404).end();
    streamFile(req, res, file, name.endsWith('.png') ? 'image/png' : 'image/jpeg');
  });

  router.get('/artists', (_req, res) => {
    res.json({
      artists: all(
        `SELECT a.*, COUNT(t.id) AS track_count, COALESCE(SUM(t.duration), 0) AS seconds
         FROM artists a LEFT JOIN tracks t ON t.artist_id = a.id AND t.kind = 'song'
         GROUP BY a.id HAVING track_count > 0 ORDER BY LOWER(a.name) ASC`
      ),
    });
  });

  router.get('/artists/:id', (req, res) => {
    const artist = get('SELECT * FROM artists WHERE id = ?', req.params.id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    res.json({ artist, tracks: listTracks(`WHERE t.artist_id = ? AND t.kind = 'song'`, [artist.id], 'LOWER(t.title) ASC') });
  });

  router.get('/albums', (_req, res) => {
    res.json({
      albums: all(
        `SELECT al.*, a.name AS artist, COUNT(t.id) AS track_count, COALESCE(SUM(t.duration), 0) AS seconds
         FROM albums al
         LEFT JOIN artists a ON a.id = al.artist_id
         LEFT JOIN tracks t ON t.album_id = al.id AND t.kind = 'song'
         GROUP BY al.id HAVING track_count > 0
         ORDER BY LOWER(a.name) ASC, LOWER(al.title) ASC`
      ),
    });
  });

  router.get('/albums/:id', (req, res) => {
    const album = get(
      `SELECT al.*, a.name AS artist FROM albums al LEFT JOIN artists a ON a.id = al.artist_id WHERE al.id = ?`,
      req.params.id
    );
    if (!album) return res.status(404).json({ error: 'Album not found' });
    res.json({ album, tracks: listTracks(`WHERE t.album_id = ? AND t.kind = 'song'`, [album.id], 'LOWER(t.title) ASC') });
  });

  const playlistRows = () =>
    all(
      `SELECT p.*, COUNT(pi.track_id) AS track_count,
              COALESCE((SELECT t2.cover FROM playlist_items pi2 JOIN tracks t2 ON t2.id = pi2.track_id WHERE pi2.playlist_id = p.id ORDER BY pi2.position LIMIT 1), p.cover) AS cover
       FROM playlists p LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
       GROUP BY p.id ORDER BY LOWER(p.name) ASC`
    );

  router.get('/playlists', (_req, res) => res.json({ playlists: playlistRows() }));

  router.post('/playlists', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Give the playlist a name' });
    const key = sortKey(name);
    if (get('SELECT id FROM playlists WHERE sort_key = ?', key)) return res.status(409).json({ error: `You already have a playlist called ${name}` });
    const id = newId();
    run('INSERT INTO playlists (id, name, sort_key, description, cover, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, name, key, String(req.body?.description ?? '').trim() || null, null, now());
    res.status(201).json({ playlist: get('SELECT * FROM playlists WHERE id = ?', id) });
  });

  router.patch('/playlists/:id', (req, res) => {
    const row = get('SELECT * FROM playlists WHERE id = ?', req.params.id);
    if (!row) return res.status(404).json({ error: 'Playlist not found' });
    const name = req.body?.name != null ? String(req.body.name).trim() : row.name;
    if (!name) return res.status(400).json({ error: 'A playlist needs a name' });
    const clash = get('SELECT id FROM playlists WHERE sort_key = ? AND id != ?', sortKey(name), row.id);
    if (clash) return res.status(409).json({ error: `You already have a playlist called ${name}` });
    run('UPDATE playlists SET name = ?, sort_key = ?, description = ? WHERE id = ?', name, sortKey(name), req.body?.description != null ? String(req.body.description) : row.description, row.id);
    res.json({ playlist: get('SELECT * FROM playlists WHERE id = ?', row.id) });
  });

  router.delete('/playlists/:id', (req, res) => {
    run('DELETE FROM playlists WHERE id = ?', req.params.id);
    res.json({ ok: true });
  });

  router.get('/playlists/:id', (req, res) => {
    const playlist = get('SELECT * FROM playlists WHERE id = ?', req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    res.json({
      playlist,
      tracks: all(`${TRACK_SELECT} JOIN playlist_items pi ON pi.track_id = t.id WHERE pi.playlist_id = ? ORDER BY pi.position ASC`, req.params.id),
    });
  });

  router.post('/playlists/:id/items', (req, res) => {
    const ids = Array.isArray(req.body?.trackIds) ? req.body.trackIds : [req.body?.trackId].filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'Nothing to add' });
    const top = get('SELECT COALESCE(MAX(position), 0) AS m FROM playlist_items WHERE playlist_id = ?', req.params.id)?.m ?? 0;
    tx(() => {
      ids.forEach((trackId, i) => {
        if (!get('SELECT id FROM tracks WHERE id = ?', trackId)) return;
        run('INSERT OR IGNORE INTO playlist_items (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)', req.params.id, trackId, top + i + 1, now());
      });
    });
    res.json({ playlist: get('SELECT * FROM playlists WHERE id = ?', req.params.id), count: get('SELECT COUNT(*) AS c FROM playlist_items WHERE playlist_id = ?', req.params.id).c });
  });

  router.delete('/playlists/:id/items/:trackId', (req, res) => {
    run('DELETE FROM playlist_items WHERE playlist_id = ? AND track_id = ?', req.params.id, req.params.trackId);
    res.json({ ok: true });
  });

  router.put('/playlists/:id/items', (req, res) => {
    const order = Array.isArray(req.body?.trackIds) ? req.body.trackIds : [];
    tx(() => {
      order.forEach((trackId, i) => run('UPDATE playlist_items SET position = ? WHERE playlist_id = ? AND track_id = ?', i + 1, req.params.id, trackId));
    });
    res.json({ ok: true });
  });

  router.get('/search', (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json({ query: q, tracks: [], artists: [], albums: [], playlists: [] });
    const like = `%${q}%`;
    res.json({
      query: q,
      tracks: listTracks('WHERE t.title LIKE ? OR a.name LIKE ? OR al.title LIKE ?', [like, like, like], 't.plays DESC, t.added_at DESC').slice(0, 30),
      artists: all('SELECT * FROM artists WHERE name LIKE ? ORDER BY LOWER(name) LIMIT 10', like),
      albums: all('SELECT * FROM albums WHERE title LIKE ? ORDER BY LOWER(title) LIMIT 10', like),
      playlists: all('SELECT * FROM playlists WHERE name LIKE ? ORDER BY LOWER(name) LIMIT 10', like),
      catalog: catalog({ q }).slice(0, 40),
    });
  });

  router.get('/library', (_req, res) => {
    res.json({
      stats: stats(),
      recent: listTracks('', [], 't.added_at DESC').slice(0, 12),
      popular: listTracks('WHERE t.plays > 0', [], 't.plays DESC, t.last_played_at DESC').slice(0, 12),
      artists: all(`SELECT a.*, COUNT(t.id) AS track_count FROM artists a LEFT JOIN tracks t ON t.artist_id = a.id AND t.kind = 'song' GROUP BY a.id HAVING track_count > 0 ORDER BY LOWER(a.name) LIMIT 12`),
      albums: all(`SELECT al.*, a.name AS artist, COUNT(t.id) AS track_count FROM albums al LEFT JOIN artists a ON a.id = al.artist_id LEFT JOIN tracks t ON t.album_id = al.id AND t.kind = 'song' GROUP BY al.id HAVING track_count > 0 ORDER BY al.created_at DESC LIMIT 12`),
      podcasts: listTracks(`WHERE t.kind = 'podcast'`, [], 't.added_at DESC').slice(0, 12),
      lessons: listTracks(`WHERE t.kind = 'lesson'`, [], 't.added_at DESC').slice(0, 12),
      spoken: listTracks(`WHERE t.kind != 'song'`, [], 't.added_at DESC').slice(0, 18),
      playlists: playlistRows(),
      tracks: listTracks('', [], 'LOWER(a.name) ASC, LOWER(t.title) ASC'),
      channels: listChannels(),
    });
  });

  router.post('/add', (req, res) => {
    const url = String(req.body?.url ?? '').trim();
    const kind = isKind(req.body?.kind) ?? 'song';
    const channel = typeof req.body?.channel === 'string' ? req.body.channel : null;
    if (!/^https?:\/\/\S+$/i.test(url)) return res.status(400).json({ error: 'Lahn could not read that source. Try saving it again.' });
    if (isDuplicateUrl(url)) return res.status(409).json({ error: 'That one is already being downloaded.' });
    const job = createJob(url, { kind, channelId: channel });
    res.status(202).json({ jobId: job.id });
  });

  router.get('/channels', (_req, res) => res.json({ channels: listChannels() }));

  router.post('/channels', async (req, res, next) => {
    try {
      const channel = await addChannel(req.body?.url, isKind(req.body?.kind) ?? 'podcast');
      res.status(201).json({ channel });
    } catch (err) {
      next(err);
    }
  });

  router.get('/channels/:id', (req, res) => {
    const data = channelUploads(req.params.id);
    if (!data) return res.status(404).json({ error: 'Channel not found' });
    res.json(data);
  });

  router.post('/channels/:id/refresh', async (req, res, next) => {
    try {
      res.json(await refreshChannel(req.params.id));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/channels/:id', (req, res) => {
    if (!channelUploads(req.params.id)) return res.status(404).json({ error: 'Channel not found' });
    deleteChannel(req.params.id);
    res.json({ ok: true, keptOnDisk: true });
  });

  router.get('/shelves', (_req, res) => {
    const data = shelves();
    if (!data.ready) refreshAll().catch(() => {});
    res.json(data);
  });

  router.get('/catalog', (req, res) => {
    const items = catalog({ kind: isKind(req.query.kind), shelf: String(req.query.shelf ?? '').trim() || null, q: req.query.q });
    res.json({ items, ready: shelves().ready });
  });

  router.post('/channels/refresh-all', async (_req, res, next) => {
    try {
      await refreshAll();
      res.json(shelves());
    } catch (err) {
      next(err);
    }
  });

  router.get('/jobs', (_req, res) => res.json({ jobs: listJobs() }));

  router.get('/jobs/:id', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  });

  router.get('/jobs/:id/events', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    if (!subscribe(req.params.id, res)) {
      res.write(`data: ${JSON.stringify({ status: 'gone' })}\n\n`);
      res.end();
      return;
    }
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(ping);
      unsubscribe(req.params.id, res);
    });
  });

  router.post('/jobs/:id/cancel', (req, res) => {
    res.json({ ok: cancel(req.params.id) });
  });

  /* One shared now-playing session so the PC and the phone feel like one app. */
  router.get('/session', (_req, res) => res.json({ session: playback.current() }));

  router.put('/session', (req, res) => {
    const claimed = playback.claim(req.body?.session, req.body?.device);
    if (!claimed) return res.status(400).json({ error: 'Lahn did not recognise that device.' });
    res.json({ session: claimed });
  });

  router.get('/session/events', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    playback.subscribe(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(ping);
      playback.unsubscribe(res);
    });
  });

  router.post('/scan', async (_req, res) => {
    const scanned = await scanLibrary();
    const pruned = pruneMissing();
    log.info(`scan: ${scanned.added} new file(s), ${pruned.removed} missing row(s) removed`);
    res.json({ ...scanned, ...pruned, stats: stats() });
  });

  router.use((err, _req, res, _next) => {
    log.error(err.stack || err.message);
    res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
  });

  return router;
}

function streamFile(req, res, file, type) {
  const stat = statSync(file);
  const range = req.headers.range;
  const common = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=86400', 'last-modified': stat.mtime.toUTCString() };

  if (!range) {
    res.writeHead(200, { ...common, 'content-length': stat.size });
    if (req.method === 'HEAD') return res.end();
    const whole = createReadStream(file);
    whole.on('error', (err) => {
      log.error('stream failed:', err.message);
      res.destroy();
    });
    req.on('close', () => whole.destroy());
    return whole.pipe(res);
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) {
    res.status(416).setHeader('content-range', `bytes */${stat.size}`);
    return res.end();
  }
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : stat.size - 1;
  if (match[1] === '' && match[2] !== '') {
    start = Math.max(0, stat.size - Number(match[2]));
    end = stat.size - 1;
  }
  end = Math.min(end, stat.size - 1);
  if (Number.isNaN(start) || start > end || start >= stat.size) {
    res.status(416).setHeader('content-range', `bytes */${stat.size}`);
    return res.end();
  }

  res.writeHead(206, { ...common, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${stat.size}` });
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(file, { start, end });
  stream.on('error', (err) => {
    log.error('stream failed:', err.message);
    res.destroy();
  });
  req.on('close', () => stream.destroy());
  stream.pipe(res);
}
