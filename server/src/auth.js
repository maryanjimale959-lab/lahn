import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import db, { all, get, newId, now, run } from './db.js';
import { cleanInterests } from './channels.js';

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  interests TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

/* What a listener kept, and what they heard last — both are per person, not per house. */
CREATE TABLE IF NOT EXISTS likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_key)
);

CREATE TABLE IF NOT EXISTS history (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  title TEXT NOT NULL,
  channel TEXT,
  thumbnail TEXT,
  duration REAL NOT NULL DEFAULT 0,
  position REAL NOT NULL DEFAULT 0,
  played_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_key)
);

CREATE INDEX IF NOT EXISTS history_recent_idx ON history (user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON user_sessions (user_id, expires_at);

/* Someone idling on the Wi-Fi should not be able to guess their way through a door. */
CREATE TABLE IF NOT EXISTS user_locks (
  email TEXT PRIMARY KEY,
  tries INTEGER NOT NULL DEFAULT 0,
  until INTEGER NOT NULL DEFAULT 0
);
`);

const hasColumn = (table, name) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === name);
if (!hasColumn('playlists', 'user_id')) {
  db.exec('ALTER TABLE playlists ADD COLUMN user_id TEXT');
}

const COOKIE = 'lahn_token';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const fail = (code) => {
  throw Object.assign(new Error(code), { code });
};

const hashOf = (password, salt) => scryptSync(password, salt, 64).toString('hex');

const sameHash = (a, b) => {
  const one = Buffer.from(a, 'hex');
  const two = Buffer.from(b, 'hex');
  return one.length === two.length && timingSafeEqual(one, two);
};

export const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  interests: interestsOf(user),
  created_at: user.created_at,
});

export const interestsOf = (user) => {
  try {
    return cleanInterests(JSON.parse(user?.interests ?? '[]'));
  } catch {
    return [];
  }
};

export function accountCount() {
  return get('SELECT COUNT(*) AS n FROM users').n;
}

/** Laxan opens for whoever is on the Wi-Fi until Maryam creates the first account. */
export const isLocked = () => accountCount() > 0;

export function signUp({ email, name, password, interests } = {}) {
  const clean = String(email ?? '').trim().toLowerCase();
  if (!EMAIL.test(clean)) fail('bad-email');
  if (String(password ?? '').length < 6) fail('short-password');
  if (get('SELECT id FROM users WHERE email = ?', clean)) fail('email-taken');

  const salt = randomBytes(16).toString('hex');
  const user = {
    id: newId(),
    email: clean,
    name: String(name ?? '').trim().slice(0, 40) || clean.split('@')[0],
    salt,
    hash: hashOf(String(password), salt),
    interests: JSON.stringify(cleanInterests(interests)),
    created_at: now(),
    last_seen_at: now(),
  };
  run(
    'INSERT INTO users (id, email, name, salt, hash, interests, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    user.id, user.email, user.name, user.salt, user.hash, user.interests, user.created_at, user.last_seen_at
  );
  return user;
}

export function signIn({ email, password } = {}) {
  const clean = String(email ?? '').trim().toLowerCase();
  const blocked = get('SELECT * FROM user_locks WHERE email = ? AND until > ?', clean, now());
  if (blocked) fail('try-later');

  const user = get('SELECT * FROM users WHERE email = ?', clean);
  if (!user || !sameHash(hashOf(String(password ?? ''), user.salt), user.hash)) {
    const seen = get('SELECT * FROM user_locks WHERE email = ?', clean);
    const tries = (seen?.tries ?? 0) + 1;
    /* Someone on the Wi-Fi is not supposed to be able to guess their way in. */
    const until = tries >= 8 ? now() + 60000 : 0;
    if (seen) run('UPDATE user_locks SET tries = ?, until = ? WHERE email = ?', tries, until, clean);
    else run('INSERT INTO user_locks (email, tries, until) VALUES (?, ?, ?)', clean, tries, until);
    fail('no-match');
  }
  run('DELETE FROM user_locks WHERE email = ?', clean);
  run('UPDATE users SET last_seen_at = ? WHERE id = ?', now(), user.id);
  return user;
}

export function startSession(userId) {
  const token = randomBytes(24).toString('hex');
  run('INSERT INTO user_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', token, userId, now(), now() + WEEK_MS);
  return { token, maxAge: WEEK_MS / 1000 };
}

export function cookieHeaders(req) {
  return String(req.headers.cookie ?? '')
    .split(';')
    .map((bit) => bit.trim())
    .filter(Boolean)
    .reduce((out, bit) => {
      const i = bit.indexOf('=');
      if (i > 0) out[bit.slice(0, i)] = decodeURIComponent(bit.slice(i + 1));
      return out;
    }, {});
}

export function userFromRequest(req) {
  const token = cookieHeaders(req)[COOKIE];
  if (!token) return null;
  const row = get(
    `SELECT u.*, s.expires_at FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
    token
  );
  if (!row) return null;
  if (row.expires_at < now()) {
    run('DELETE FROM user_sessions WHERE token = ?', token);
    return null;
  }
  return row;
}

export function endSession(req) {
  const token = cookieHeaders(req)[COOKIE];
  if (token) run('DELETE FROM user_sessions WHERE token = ?', token);
}

export function setInterests(userId, interests) {
  run('UPDATE users SET interests = ? WHERE id = ?', JSON.stringify(cleanInterests(interests)), userId);
}

export function renameUser(userId, name) {
  const clean = String(name ?? '').trim().slice(0, 40);
  if (!clean) fail('bad-name');
  run('UPDATE users SET name = ? WHERE id = ?', clean, userId);
}

export function dropAccount(userId) {
  run('DELETE FROM playlists WHERE user_id = ?', userId);
  run('DELETE FROM users WHERE id = ?', userId);
}

/* ---------- what a listener kept and last heard ---------- */

export function listLikes(userId) {
  return all('SELECT item_key FROM likes WHERE user_id = ?', userId).map((r) => r.item_key);
}

export function toggleLike(userId, key, on) {
  if (!key) return;
  if (on) run('INSERT OR IGNORE INTO likes (user_id, item_key, added_at) VALUES (?, ?, ?)', userId, key, now());
  else run('DELETE FROM likes WHERE user_id = ? AND item_key = ?', userId, key);
}

export function listHistory(userId, limit = 30) {
  return all('SELECT * FROM history WHERE user_id = ? ORDER BY played_at DESC LIMIT ?', userId, limit);
}

export function notePlayed(userId, item, position = 0) {
  if (!userId || !item?.key) return;
  run(
    `INSERT INTO history (user_id, item_key, title, channel, thumbnail, duration, position, played_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, item_key) DO UPDATE SET position = excluded.position, played_at = excluded.played_at,
       title = excluded.title, channel = excluded.channel, thumbnail = excluded.thumbnail, duration = excluded.duration`,
    userId, item.key, item.title ?? item.key, item.channel ?? null, item.thumbnail ?? null, item.duration ?? 0, position, now()
  );
}
