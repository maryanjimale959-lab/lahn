/* Laxan's public preview, baked. A hosted build has no server behind it, so this boots a
   licensed-only Laxan of its own — its own database, its own library folder, its own port — reads
   every shelf off it and writes web/public/demo.json. Two kinds of row survive into that file: a
   source that hands out its own audio file, which the browser fetches directly, and a song whose
   own page is on the artist's channel, which the tap hands back to them so the listen counts
   where it belongs. Her real library is never opened and no audio is ever copied here. */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, `.tmp-demo-${Date.now()}`);
const PORT = 4797;
const API = `http://localhost:${PORT}/api`;
const OUT = path.join(ROOT, 'web', 'public', 'demo.json');
const LINKS = 8;

const problems = [];
const fail = (line) => problems.push(line);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  windowsHide: true,
  stdio: ['ignore', 'ignore', 'pipe'],
  env: {
    ...process.env,
    LAHN_PORT: String(PORT),
    LAHN_DATA: path.join(TMP, 'data'),
    LAHN_LIBRARY: path.join(TMP, 'library'),
  },
});
server.stderr.on('data', (c) => process.stdout.write(`  server│ ${c}`));

const tidy = () => {
  server.kill();
  try {
    rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {
    /* Windows keeps a folder locked for a moment after the process in it dies. */
  }
};
process.on('exit', tidy);
process.on('SIGINT', () => process.exit(1));

async function until(what, check, { tries = 90, every = 1000 } = {}) {
  for (let n = 0; n < tries; n += 1) {
    if (await check().catch(() => null)) return true;
    await wait(every);
  }
  fail(`timed out waiting for ${what}`);
  return false;
}

const get = async (route) => {
  const res = await fetch(`${API}${route}`);
  if (!res.ok) throw new Error(`${route} → ${res.status}`);
  return res.json();
};

/* The probe has to behave like the browser that will ask after it: Buzzsprout's CDN answers 403 to
   a bare request and 206 to one carrying a user agent, so a probe without one throws away five
   Somali podcasts. A second try covers a server that only objects to being asked eight at a time. */
const BROWSER = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  accept: 'audio/*/*',
};
async function answers(url) {
  for (let try_ = 0; try_ < 2; try_ += 1) {
    try {
      const res = await fetch(url, { headers: { ...BROWSER, range: 'bytes=0-1' }, signal: AbortSignal.timeout(20000) });
      const type = String(res.headers.get('content-type') ?? '');
      const size = Number(res.headers.get('content-length') ?? 0);
      await res.body?.cancel().catch(() => {});
      if (res.ok) {
        if (!/audio|video|octet-stream/i.test(type) && !/\.(mp3|m4a|aac|ogg|opus)(\?|$)/i.test(url)) return `type ${type || 'none'}`;
        /* A server that honoured the range sent two bytes; one that ignored it sent the whole file. */
        if (res.status === 200 && size && size < 20000) return `only ${size} bytes`;
        return null;
      }
      if (res.status !== 403 && res.status !== 429) return `http ${res.status}`;
    } catch (err) {
      if (try_) return err.name === 'TimeoutError' ? 'timed out' : err.message;
    }
    await wait(400);
  }
  return 'refused twice';
}

console.log('booting a throwaway Laxan that carries only what may be published…\n');
if (!(await until('it to come up', async () => (await get('/health')).ok))) process.exit(1);
await until('every source to answer', async () => (await get('/shelves')).ready, { tries: 120 });

const home = await get('/shelves');
const sources = (await get('/channels')).channels;
const kinds = [...new Set(home.shelves.flatMap((s) => s.items.map((i) => i.kind)))];

console.log(`  ${home.total} items on ${home.shelves.length} rows from ${sources.length} sources\n`);

/* The shelf page and the source page hold more than Home's twelve-card rows, so each is read on
   its own rather than trimmed to what Home happened to show. */
const pages = {};
for (const shelf of home.shelves) {
  if (shelf.id === 'foryou' || shelf.id === 'fresh') continue;
  pages[shelf.id] = (await get(`/catalog?shelf=${shelf.id}`)).items;
}
const byKind = {};
for (const kind of kinds) byKind[kind] = (await get(`/catalog?kind=${kind}`)).items;

const uploads = {};
for (const channel of sources) uploads[channel.id] = (await get(`/channels/${channel.id}`)).uploads;

/* ---- keep what a browser can fetch on its own, and what it can hand back to its owner ---- */
const all = new Map();
const handed = new Map();
const WATCH = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i;
const add = (item) => {
  if (!item) return;
  /* Set when the source hands out the file itself: the preview plays that file. */
  if (item.audio) all.set(item.key, item);
  else if (!item.licensed && WATCH.test(item.url ?? '')) {
    handed.set(item.key, {
      ...item,
      link: item.url,
      thumbnail: /^https:\/\//i.test(item.thumbnail ?? '') ? item.thumbnail : `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    });
  }
};
/* A channel's own upload list is read for its ordering only: those rows carry no shelf or kind,
   so cataloguing them here would put bare items on the shelves. */
for (const list of [home.shelves.flatMap((s) => s.items), Object.values(pages).flat(), Object.values(byKind).flat()].flat()) add(list);

console.log(`  ${all.size} carry their own file link, ${handed.size} live on their creator's page`);
console.log(`  checking every file link…`);
const dead = new Map();
const queue = [...all.values()];
let done = 0;
const lane = async () => {
  while (queue.length) {
    const item = queue.shift();
    const why = await answers(item.audio);
    if (why) dead.set(item.key, why);
    all.delete(item.key);
    if (!why) all.set(item.key, item);
    done += 1;
    if (done % 40 === 0) process.stdout.write(`\r  checked ${done}/${queue.length + done}`);
  }
};
await Promise.all(Array.from({ length: LINKS }, lane));
console.log(`\n  ${all.size} play, ${dead.size} do not\n`);

const keys = (list) => list.map((i) => i.key).filter((k) => all.has(k) || handed.has(k));

/* A shelf is a screen of choices, not one artist's whole discography: the rows that live on
   their creator's page are kept newest-first and thinned per shelf and per channel, so the file
   a visitor downloads stays small and no single channel fills the preview. */
const SONG_SHELVES = new Set(['music', 'rap', 'love', 'amusic']);
const perSlot = new Map();
const thin = (i) => {
  const slot = i.shelf ?? `ch:${i.channelId}`;
  /* Only the shelves with nothing licensed of their own are handed out; the rest already play. */
  if (i.shelf && !SONG_SHELVES.has(i.shelf)) return false;
  const used = perSlot.get(slot) ?? 0;
  if (used >= 36) return false;
  perSlot.set(slot, used + 1);
  return true;
};
const ontoChannel = [...handed.values()].sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0)).filter(thin);
handed.clear();
for (const i of ontoChannel) handed.set(i.key, i);

const pick = (i) => ({
  key: i.key,
  id: i.id,
  title: i.title,
  audio: i.audio ?? null,
  /* A row with no file of its own points at the page it came from: the listen happens there. */
  link: i.link ?? null,
  duration: i.duration ?? 0,
  thumbnail: i.thumbnail ?? null,
  uploadedAt: i.uploadedAt ?? 0,
  kind: i.kind,
  shelf: i.shelf ?? null,
  channelId: i.channelId,
  channel: i.channel,
});
const items = [...all.values(), ...ontoChannel].map(pick);

const payload = {
  laxanDemo: 1,
  bakedAt: new Date().toISOString(),
  version: (await get('/health')).version,
  interests: (await get('/interests')).interests,
  items,
  /* Home's rows and each shelf's own page are the server's ordering, not a re-sort: the sources
     take turns at the top so one feed cannot hide the rest of the shelf. */
  rows: home.shelves.map((s) => ({ id: s.id, picked: home.picked.includes(s.id), keys: keys(s.items) })).filter((s) => s.keys.length),
  shelfPages: Object.fromEntries(Object.entries(pages).map(([id, list]) => [id, keys(list)])),
  kindPages: Object.fromEntries(Object.entries(byKind).map(([k, list]) => [k, keys(list)])),
  sources: sources.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    shelf: c.shelf ?? null,
    image: c.image ?? null,
    preview: c.preview ?? null,
    health: c.health,
    uploadCount: c.uploadCount,
  })),
  channelPages: Object.fromEntries(Object.entries(uploads).map(([id, list]) => [id, keys(list)])),
};

/* Anything scraped as audio, any private path, any address of hers: none of it may reach a public
   file. What may reach it is a page address — the creator's own — and the artwork they publish. */
const offline = JSON.stringify({
  ...payload,
  items: payload.items.map(({ link, thumbnail, ...rest }) => rest),
  sources: payload.sources.map(({ image, preview, ...rest }) => rest),
});
for (const [what, re] of [
  ['a scraped audio address', /youtube|youtu\.be|googlevideo|ytimg/i],
  ['a Windows path', /[A-Za-z]:\\\\/],
  ['an API route', /\/api\//],
  ['an email address', /[\w.+-]+@[\w-]+\.[a-z]{2,}/i],
  ['her machine', /localhost|127\.0\.0\.1|192\.168\./i],
]) {
  if (re.test(offline)) fail(`the payload still carries ${what}`);
}
if (payload.items.some((i) => i.audio && /youtube|youtu\.be|googlevideo|ytimg/i.test(i.audio))) {
  fail('an audio link points at a video host — nothing scraped may be streamed');
}
if (payload.items.some((i) => !i.audio && !i.link)) fail('a row can neither play nor hand off to its page');
if (payload.items.some((i) => /[^\x20-\x7e]/.test(`${i.audio}${i.link ?? ''}`))) fail('a link holds a character a URL cannot carry');
if (payload.items.length < 120) fail(`only ${payload.items.length} playable items — too thin to show anybody`);
if (payload.rows.filter((r) => !['foryou', 'fresh'].includes(r.id)).length < 3) fail('fewer than three shelves survived');

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload));
const kb = Math.round(statSync(OUT).size / 1024);

console.log(
  `baked ${payload.items.length} items — ${payload.items.length - ontoChannel.length} stream in-house, ${ontoChannel.length} go to their creator's page — from ${payload.sources.length} sources → web/public/demo.json (${kb} KB)`
);
for (const row of payload.rows) console.log(`  ${row.id.padEnd(9)} ${row.keys.length}`);
if (dead.size) console.log(`  dropped ${dead.size} that no longer answer, e.g. ${[...dead.values()].slice(0, 3).join(' / ')}`);
console.log(problems.length ? `\n${problems.length} problem(s):` : '\n0 problems — the preview is ready to build');
for (const p of problems) console.log(`  ✗ ${p}`);
process.exit(problems.length ? 1 : 0);
