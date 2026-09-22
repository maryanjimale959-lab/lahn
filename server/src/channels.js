import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { all, get, newId, now, run, sortKey } from './db.js';
import { LIBRARY_DIR } from './config.js';
import { log } from './log.js';
import { fetchBinary, listUploads } from './ytdlp.js';

const CACHE_MS = 6 * 60 * 60 * 1000;
const LIMIT = 24;

/**
 * Lahn's whole catalogue comes from these sources — Somali channels she follows, plus a
 * saved search for the music shelves so she never has to paste a link.
 * `shelf` marks the rows that become their own row on the home screen.
 */
const DEFAULTS = [
  { name: 'Heeso Soomaali', url: 'ytsearch30:heeso somali cusub', kind: 'song', shelf: 'music' },
  { name: 'Rap Soomaali', url: 'ytsearch30:rap somali cusub 2026', kind: 'song', shelf: 'rap' },
  { name: 'Hees Jaceyl', url: 'ytsearch30:hees jaceyl somali', kind: 'song', shelf: 'love' },
  { name: 'Codka Ubax', url: 'https://www.youtube.com/@CodkaUbax/videos', kind: 'book' },
  { name: 'Abdijaliil Show', url: 'https://www.youtube.com/@Abdijalilshow/videos', kind: 'podcast' },
  { name: 'Madari Podcast', url: 'https://www.youtube.com/@madaripodcast/videos', kind: 'podcast' },
  { name: 'Guntiino Podcast', url: 'https://www.youtube.com/@GuntiinoPodcast/videos', kind: 'podcast' },
  { name: 'Sultan Films', url: 'https://www.youtube.com/@sultaanfilms/videos', kind: 'podcast' },
  { name: 'DADWEYNAHA', url: 'https://www.youtube.com/@DADWEYNAHA/videos', kind: 'story' },
  { name: 'Sawda Qaalib', url: 'https://www.youtube.com/@sawdamqaalib/videos', kind: 'story' },
  { name: 'Dugsiiye', url: 'https://www.youtube.com/@dugsiiye/videos', kind: 'lesson' },
];

/* The first cut shipped Arabic channels; this app is for Somali listeners now. */
const RETIRED = ['ABtalks', 'AJpluskibreet', 'm7ns', 'Alaraby-Tube', 'programmingwithmosh', 'WideBot'].map((h) => `https://www.youtube.com/@${h}/videos`);

const pending = new Map();
let warming = null;

export function channelUrl(input) {
  const raw = String(input ?? '').trim().replace(/\s+/g, '');
  if (!raw) return null;
  const rest = raw.replace(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i, '');
  const handle = /^@[\w.-]{2,60}/.exec(rest)?.[0];
  if (handle) return `https://www.youtube.com/${handle}/videos`;
  const id = /^channel\/(UC[\w-]{6,})/.exec(rest)?.[1];
  if (id) return `https://www.youtube.com/channel/${id}/videos`;
  const custom = /^(?:c|user)\/([\w.-]{2,60})/.exec(rest)?.[1];
  if (custom) return `https://www.youtube.com/c/${custom}/videos`;
  return null;
}

function nameFromUrl(url) {
  return decodeURIComponent(/youtube\.com\/(@?[\w.-]+)/.exec(url)?.[1] ?? 'Channel').replace(/^@/, '');
}

/* Flat-playlist rows come back as "hq720_custom_N.jpg?sqp=…" links that browsers
   routinely refuse to render. hqdefault always exists, and object-fit:cover crops the
   letterbox bars off it, so a 16:9 card shows a clean 480px frame. */
function withPoster(entry) {
  const vid = /youtu(?:\.be\/|be\.com\/(?:watch\?v=|shorts\/|live\/|embed\/))([\w-]{11})/.exec(entry?.url ?? '')?.[1];
  return vid ? { ...entry, thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` } : entry;
}

function parse(uploads) {
  try {
    const list = JSON.parse(uploads ?? '[]');
    return Array.isArray(list) ? list.map(withPoster) : [];
  } catch {
    return [];
  }
}

/* YouTube hands back names like "DADWEYNAHA ," — trailing punctuation reads as a bug. */
const niceName = (name) => String(name ?? '').replace(/\s+/g, ' ').replace(/[\s,.;:!|·]+$/, '').trim();

function row(channel) {
  const { uploads, ...rest } = channel;
  const list = parse(uploads);
  return {
    ...rest,
    name: niceName(rest.name),
    uploadCount: list.length,
    preview: list[0]?.thumbnail ?? null,
    isSearch: String(channel.url).startsWith('ytsearch'),
  };
}

function savedIds() {
  return new Map(all('SELECT id, source_id FROM tracks WHERE source_id IS NOT NULL').map((t) => [t.source_id, t.id]));
}

export function listChannels() {
  return all('SELECT * FROM channels ORDER BY LOWER(name) ASC').map(row);
}

export function channelById(id) {
  return get('SELECT * FROM channels WHERE id = ?', id) ?? null;
}

const CHANNEL_TRACKS = `SELECT t.*, a.name AS artist, al.title AS album
  FROM tracks t
  LEFT JOIN artists a ON a.id = t.artist_id
  LEFT JOIN albums al ON al.id = t.album_id
  WHERE t.channel_id = ?`;

export function channelUploads(id) {
  const channel = channelById(id);
  if (!channel) return null;
  const saved = savedIds();
  const uploads = parse(channel.uploads).map((u) => ({ ...u, savedTrackId: saved.get(u.id) ?? null }));
  return { channel: row(channel), uploads, fresh: isFresh(channel), tracks: all(`${CHANNEL_TRACKS} ORDER BY t.added_at DESC`, id) };
}

const isFresh = (channel) => Date.now() - (channel.fetched_at ?? 0) < CACHE_MS;

/** Everything the sources have published, newest first, with the shelf each row belongs to. */
export function catalog({ kind = null, shelf = null, q = null } = {}) {
  const saved = savedIds();
  const needle = q ? String(q).trim().toLowerCase() : null;
  const items = [];
  for (const channel of all('SELECT * FROM channels')) {
    if (kind && channel.kind !== kind) continue;
    if (shelf && channel.shelf !== shelf) continue;
    const name = niceName(channel.name);
    for (const u of parse(channel.uploads)) {
      if (needle && !`${u.title} ${name}`.toLowerCase().includes(needle)) continue;
      items.push({
        key: `${channel.id}:${u.id}`,
        id: u.id,
        title: u.title,
        url: u.url,
        duration: u.duration,
        thumbnail: u.thumbnail,
        uploadedAt: u.uploadedAt,
        kind: channel.kind,
        shelf: channel.shelf,
        channelId: channel.id,
        channel: name,
        savedTrackId: saved.get(u.id) ?? null,
      });
    }
  }
  return items.sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
}

const take = (list, n = 18) => list.slice(0, n);

export function shelves() {
  const items = catalog();
  const byKind = (kind) => items.filter((i) => i.kind === kind);
  const byShelf = (shelf) => items.filter((i) => i.shelf === shelf);
  const rows = [
    { id: 'fresh', items: take(items) },
    { id: 'music', items: take(byShelf('music')) },
    { id: 'rap', items: take(byShelf('rap')) },
    { id: 'love', items: take(byShelf('love')) },
    { id: 'podcasts', items: take(byKind('podcast')) },
    { id: 'books', items: take(byKind('book')) },
    { id: 'stories', items: take(byKind('story')) },
    { id: 'lessons', items: take(byKind('lesson')) },
  ].filter((shelf) => shelf.items.length);

  return { shelves: rows, ready: all('SELECT fetched_at FROM channels').every(isFresh), total: items.length };
}

/** Channel art is cached once per source so the grid still looks right on a plane. */
async function cacheArt(id, remote) {
  if (!remote) return null;
  const file = `covers/channel-${id}.jpg`;
  const absolute = path.join(LIBRARY_DIR, file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  if (existsSync(absolute)) return file;
  try {
    writeFileSync(absolute, await fetchBinary(remote));
    return file;
  } catch (err) {
    log.warn('source art skipped:', err.message);
    return null;
  }
}

export async function addChannel(input, kind = 'podcast') {
  const url = channelUrl(input);
  if (!url) throw new Error('That does not look like a YouTube channel. Give the channel link, like youtube.com/@name.');
  const existing = get('SELECT * FROM channels WHERE url = ?', url);
  if (existing) return row(existing);

  const id = newId();
  const name = nameFromUrl(url);
  run('INSERT INTO channels (id, url, name, sort_key, kind, image, added_at, uploads, fetched_at, shelf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', id, url, name, sortKey(name), kind, null, now(), null, null, null);
  await refreshChannel(id).catch((err) => log.warn(`${name} will list later:`, err.message));
  return row(channelById(id));
}

export async function refreshChannel(id) {
  const channel = channelById(id);
  if (!channel) throw new Error('Channel not found');
  if (pending.has(id)) return pending.get(id);

  const work = (async () => {
    const info = await listUploads(channel.url, { limit: LIMIT });
    if (!info.entries.length) throw new Error(`Nothing came back from ${channel.name}.`);
    const image = channel.url.startsWith('ytsearch') ? null : await cacheArt(id, info.image);
    const name = channel.url.startsWith('ytsearch') ? channel.name : info.name || channel.name;
    run('UPDATE channels SET uploads = ?, fetched_at = ?, image = COALESCE(?, image), name = ?, sort_key = ? WHERE id = ?', JSON.stringify(info.entries), now(), image, name, sortKey(name), id);
    return channelUploads(id);
  })().finally(() => pending.delete(id));

  pending.set(id, work);
  return work;
}

/**
 * Opening the app should not wait on eleven network round trips, so the first call starts
 * the sweep and every shelf the client asks for in the meantime comes back with ready:false.
 */
export function refreshAll() {
  if (warming) return warming;
  warming = (async () => {
    const ids = all('SELECT id FROM channels').map((r) => r.id);
    for (let i = 0; i < ids.length; i += 3) {
      const batch = ids.slice(i, i + 3).map((id) => refreshChannel(id).catch((err) => log.warn('source skipped:', err.message)));
      await Promise.all(batch);
    }
  })().finally(() => {
    warming = null;
  });
  return warming;
}

export function deleteChannel(id) {
  run('DELETE FROM channels WHERE id = ?', id);
  run('UPDATE tracks SET channel_id = NULL WHERE channel_id = ?', id);
}

export function seedChannels() {
  let changed = 0;
  for (const url of RETIRED) {
    const stale = get('SELECT id, (SELECT COUNT(*) FROM tracks WHERE tracks.channel_id = channels.id) AS saves FROM channels WHERE url = ?', url);
    if (stale && !stale.saves) {
      run('DELETE FROM channels WHERE id = ?', stale.id);
      changed += 1;
    }
  }
  for (const source of DEFAULTS) {
    if (get('SELECT id FROM channels WHERE url = ?', source.url)) continue;
    run('INSERT INTO channels (id, url, name, sort_key, kind, image, added_at, uploads, fetched_at, shelf) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?)', newId(), source.url, source.name, sortKey(source.name), source.kind, now(), source.shelf ?? null);
    changed += 1;
  }
  return changed;
}
