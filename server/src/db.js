import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { DATA_DIR, DB_FILE } from './config.js';
import { log } from './log.js';

mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_key TEXT NOT NULL UNIQUE,
  image TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sort_key TEXT NOT NULL,
  artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
  image TEXT,
  year INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE (sort_key, artist_id)
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
  album_id TEXT REFERENCES albums(id) ON DELETE SET NULL,
  duration REAL NOT NULL DEFAULT 0,
  path TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL DEFAULT 0,
  cover TEXT,
  source_url TEXT,
  source_id TEXT,
  added_at INTEGER NOT NULL,
  plays INTEGER NOT NULL DEFAULT 0,
  last_played_at INTEGER,
  favourite INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_key TEXT NOT NULL UNIQUE,
  description TEXT,
  cover TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_items (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'podcast',
  image TEXT,
  added_at INTEGER NOT NULL,
  uploads TEXT,
  fetched_at INTEGER,
  shelf TEXT,
  driver TEXT NOT NULL DEFAULT 'youtube'
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT,
  percent REAL NOT NULL DEFAULT 0,
  message TEXT,
  title TEXT,
  artist TEXT,
  track_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tracks_artist_idx ON tracks (artist_id);
CREATE INDEX IF NOT EXISTS tracks_album_idx ON tracks (album_id);
CREATE INDEX IF NOT EXISTS items_order_idx ON playlist_items (playlist_id, position);
`);

/* Old libraries hold nothing but songs, so the column backfills itself to 'song'. */
const hasColumn = (table, name) => all(`PRAGMA table_info(${table})`).some((c) => c.name === name);
if (!hasColumn('tracks', 'kind')) {
  db.exec("ALTER TABLE tracks ADD COLUMN kind TEXT NOT NULL DEFAULT 'song'");
  log.info('library schema updated: tracks.kind');
}
if (!hasColumn('tracks', 'channel_id')) {
  db.exec('ALTER TABLE tracks ADD COLUMN channel_id TEXT');
  log.info('library schema updated: tracks.channel_id');
}
if (!hasColumn('channels', 'shelf')) {
  db.exec('ALTER TABLE channels ADD COLUMN shelf TEXT');
  log.info('library schema updated: channels.shelf');
}
/* Which engine fills a source: a scraped video, a podcast feed, or a recitation server. The
   last two carry their audio as a plain link and are the ones a public build may keep. */
if (!hasColumn('channels', 'driver')) {
  db.exec("ALTER TABLE channels ADD COLUMN driver TEXT NOT NULL DEFAULT 'youtube'");
  log.info('library schema updated: channels.driver');
}
db.exec('CREATE INDEX IF NOT EXISTS tracks_kind_idx ON tracks (kind)');

export const KINDS = ['song', 'podcast', 'book', 'lesson', 'story', 'quran'];
export const isKind = (value) => (KINDS.includes(value) ? value : null);

export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);
export const now = () => Date.now();

export function sortKey(...parts) {
  return parts
    .filter(Boolean)
    .join('::')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

export function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

export function get(sql, ...params) {
  return db.prepare(sql).get(...params) ?? null;
}

export function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function findOrCreateArtist(name) {
  const clean = (name || '').trim() || 'Unknown artist';
  const key = sortKey(clean);
  const existing = get('SELECT * FROM artists WHERE sort_key = ?', key);
  if (existing) return existing;
  const row = { id: newId(), name: clean, sort_key: key, image: null, created_at: now() };
  run('INSERT INTO artists (id, name, sort_key, image, created_at) VALUES (?, ?, ?, ?, ?)', row.id, row.name, row.sort_key, row.image, row.created_at);
  return row;
}

export function findOrCreateAlbum(title, artistId, year) {
  const clean = (title || '').trim() || 'Singles';
  const key = sortKey(clean);
  const existing = get('SELECT * FROM albums WHERE sort_key = ? AND (artist_id IS ? OR artist_id = ?)', key, artistId, artistId);
  if (existing) return existing;
  const row = { id: newId(), title: clean, sort_key: key, artist_id: artistId, image: null, year: year ?? null, created_at: now() };
  run('INSERT INTO albums (id, title, sort_key, artist_id, image, year, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', row.id, row.title, row.sort_key, row.artist_id, row.image, row.year, row.created_at);
  return row;
}

export function stats() {
  return get(
    `SELECT (SELECT COUNT(*) FROM tracks) AS tracks,
            (SELECT COUNT(*) FROM tracks WHERE kind = 'song') AS songs,
            (SELECT COUNT(*) FROM tracks WHERE kind = 'podcast') AS podcasts,
            (SELECT COUNT(*) FROM tracks WHERE kind = 'lesson') AS lessons,
            (SELECT COUNT(*) FROM artists) AS artists,
            (SELECT COUNT(*) FROM albums) AS albums,
            (SELECT COUNT(*) FROM playlists) AS playlists,
            (SELECT COUNT(*) FROM channels) AS channels,
            (SELECT COALESCE(SUM(duration), 0) FROM tracks) AS seconds,
            (SELECT COALESCE(SUM(duration), 0) FROM tracks WHERE kind = 'song') AS music_seconds,
            (SELECT COALESCE(SUM(size), 0) FROM tracks) AS bytes`
  );
}

export function closeDb() {
  try {
    db.close();
  } catch (err) {
    log.warn('database close skipped:', err.message);
  }
}

export default db;
