import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

const ENV = (name, fallback) => (process.env[name] && process.env[name].trim()) || fallback;

export const PORT = Number(ENV('LAHN_PORT', '4780'));
export const LIBRARY_DIR = path.resolve(ENV('LAHN_LIBRARY', path.join(REPO_ROOT, 'library')));
export const COVERS_DIR = path.join(LIBRARY_DIR, 'covers');
export const DATA_DIR = path.resolve(ENV('LAHN_DATA', path.join(SERVER_ROOT, 'data')));
export const DB_FILE = path.join(DATA_DIR, 'lahn.db');
/* Audio for things you only listened to, kept out of the library and pruned on its own. */
export const CACHE_DIR = path.join(DATA_DIR, 'stream');
export const WEB_DIST = path.join(REPO_ROOT, 'web', 'dist');

export const AUDIO_EXTENSIONS = new Set(['.m4a', '.mp3', '.opus', '.ogg', '.wav', '.flac', '.mka', '.aac']);

/* A build meant to be handed to strangers drops every shelf whose audio was scraped off a video
   site and keeps the podcast feeds and recitation servers that publish for reuse. Her own
   machine leaves this off, so nothing about the app she listens to changes. */
export const LICENSED_ONLY = /^(1|true|yes)$/i.test(ENV('LAHN_LICENSED_ONLY', ''));

/* Password-reset mail leaves through an HTTPS email API — Resend or Brevo, both a plain POST —
   so the app needs no SMTP client and no new dependency. No key, no mail: the app runs, the
   reset screen says it cannot send, and `npm run reset-password` stays the way back in.
   The provider is read off the key itself (Resend keys start with `re_`) unless you say. */
export const MAIL = {
  key: ENV('LAHN_EMAIL_KEY', '') || null,
  from: ENV('LAHN_EMAIL_FROM', '') || null,
  provider: ENV('LAHN_EMAIL_PROVIDER', '') || null,
};

/* Behind a hosting proxy the client's address arrives in X-Forwarded-For, and a rate limit that
   reads the socket would throttle the proxy instead of the stranger. Off on your own network,
   where that header would otherwise be a free way to fake an address. */
export const TRUST_PROXY = /^(1|true|yes)$/i.test(ENV('LAHN_TRUST_PROXY', ''));

const EXE = process.platform === 'win32' ? '.exe' : '';

function fromPath(name) {
  try {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(finder, [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const hit = out.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    return hit || null;
  } catch {
    return null;
  }
}

function shallowFind(root, name, depth = 4) {
  if (!existsSync(root) || depth < 0) return null;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === name) return full;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = shallowFind(path.join(root, entry.name), name, depth - 1);
    if (nested) return nested;
  }
  return null;
}

export function resolveTool(envName, name) {
  const override = process.env[envName];
  if (override && existsSync(override)) return override;
  const exe = name + EXE;
  const local = path.join(DATA_DIR, 'bin', exe);
  if (existsSync(local)) return local;
  return (
    fromPath(exe) ||
    shallowFind(path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links'), exe, 0) ||
    shallowFind(path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages'), exe) ||
    shallowFind(path.join(os.homedir(), 'Downloads'), exe, 2) ||
    null
  );
}

export function tools() {
  return {
    ytDlp: resolveTool('LAHN_YTDLP', 'yt-dlp'),
    ffmpeg: resolveTool('LAHN_FFMPEG', 'ffmpeg'),
    ffprobe: resolveTool('LAHN_FFPROBE', 'ffprobe'),
  };
}

export const APP_VERSION = '0.1.0';
