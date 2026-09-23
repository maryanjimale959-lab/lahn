/* Could this build go in front of strangers? Boots a Laxan of Laxan's own — its own database, its
   own library folder, its own port — on the published-catalogue setting, then plays one item from
   every shelf it claims to carry. Her real library is never opened. */
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, `.tmp-licensed-${Date.now()}`);
const PORT = 4791;
const API = `http://localhost:${PORT}/api`;

const problems = [];
const fail = (line) => problems.push(line);

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    LAHN_PORT: String(PORT),
    LAHN_DATA: path.join(TMP, 'data'),
    LAHN_LIBRARY: path.join(TMP, 'library'),
    LAHN_LICENSED_ONLY: '1',
  },
});
server.stdout.on('data', (c) => process.stdout.write(`  server│ ${c}`));
server.stderr.on('data', (c) => process.stdout.write(`  server│ ${c}`));

/* A crash halfway through still leaves nothing behind: the folder holds a database of its own. */
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

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function until(what, check, { tries = 60, every = 1000 } = {}) {
  for (let n = 0; n < tries; n += 1) {
    if (await check().catch(() => null)) return true;
    await wait(every);
  }
  fail(`timed out waiting for ${what}`);
  return false;
}

console.log('booting a throwaway Laxan that carries only what may be published…\n');
if (!(await until('it to come up', async () => (await fetch(`${API}/health`).then((r) => r.json())).ok))) process.exit(1);

const health = await (await fetch(`${API}/health`)).json();
if (!health.licensedOnly) fail('the server did not start in published-catalogue mode');

/* Every feed and recitation server answers once here, which is what the app does on a first open. */
await fetch(`${API}/channels/refresh-all`, { method: 'POST' });
const data = await (await fetch(`${API}/shelves`)).json();
const shelves = (data.shelves ?? []).filter((s) => !['foryou', 'fresh'].includes(s.id));

console.log(`shelves in a publishable Laxan — ${data.total} items, ready: ${data.ready}\n`);
for (const shelf of shelves) {
  const direct = shelf.items.filter((i) => i.audio).length;
  console.log(`  ${shelf.id.padEnd(10)} ${String(shelf.items.length).padStart(2)} shown, ${direct} play straight from the link`);
}

const scraped = shelves.flatMap((s) => s.items).filter((i) => i.driver === 'youtube');
if (scraped.length) fail(`${scraped.length} shelf rows still come off YouTube`);

console.log('\ntapping one from each shelf, the way she does:\n');
for (const shelf of shelves) {
  const picks = shelf.items.filter((i) => i.audio).slice(0, 1);
  for (const item of picks) {
    const key = `${item.channelId}:${item.id}`;
    const at = Date.now();
    const res = await fetch(`${API}/play/${encodeURIComponent(key)}/audio`, { headers: { range: 'bytes=0-32767' } }).catch((e) => ({ status: `THREW ${e.message}`, headers: new Map() }));
    const bytes = res.ok ? new Uint8Array(await res.arrayBuffer()).length : 0;
    const ms = Date.now() - at;
    const type = res.headers.get('content-type') ?? '';
    const range = res.headers.get('content-range') ?? '';
    const total = Number(/\/(\d+)$/.exec(range)?.[1] ?? 0);
    console.log(`  ${shelf.id.padEnd(10)} ${item.title.slice(0, 44).padEnd(46)} ${res.status} ${String(Math.round(bytes / 1024)).padStart(3)}kb of ${String(Math.round(total / 1e6 * 10) / 10).padStart(5)}mb in ${ms}ms`);
    if (res.status !== 206) fail(`${shelf.id}: ${item.title} answered ${res.status}, not 206`);
    if (!type.startsWith('audio')) fail(`${shelf.id}: ${item.title} answered ${type}, not audio`);
    if (bytes < 1024) fail(`${shelf.id}: ${item.title} sent ${bytes} bytes`);
    if (!total) fail(`${shelf.id}: ${item.title} would not say how long the file is, so the scrub bar cannot work`);
    if (ms > 8000) fail(`${shelf.id}: ${item.title} took ${ms}ms — a direct link should be instant`);
  }
}

/* The scrub bar's other half: a range from the middle of a file has to come back as that range. */
const [probe] = shelves.flatMap((s) => s.items).filter((i) => i.audio && i.duration > 600);
if (probe) {
  const head = await fetch(`${API}/play/${encodeURIComponent(`${probe.channelId}:${probe.id}`)}/audio`, { headers: { range: 'bytes=0-1' } });
  const size = Number(/\/(\d+)$/.exec(head.headers.get('content-range') ?? '')?.[1] ?? 0);
  const mid = Math.floor(size / 2);
  const res = await fetch(`${API}/play/${encodeURIComponent(`${probe.channelId}:${probe.id}`)}/audio`, { headers: { range: `bytes=${mid}-${mid + 999}` } });
  const bytes = new Uint8Array(await res.arrayBuffer()).length;
  const got = res.headers.get('content-range') ?? '';
  console.log(`\n  scrub: ${probe.title.slice(0, 40)} — jumped to byte ${mid} of ${size}, got ${bytes} bytes (${got || 'no range said back'})`);
  if (res.status !== 206 || bytes !== 1000) fail('the scrub bar cannot seek into a licensed item');
} else fail('no licensed item was long enough to test seeking on');

const search = await (await fetch(`${API}/search?q=${encodeURIComponent('Maamul')}`)).json();
console.log(`\n  search "Maamul": ${search.catalog.length} shelf hits — ${search.catalog.slice(0, 3).map((i) => i.title.slice(0, 30)).join(' | ')}`);
if (!search.catalog.length) fail('search found nothing on the licensed shelves');
if (search.catalog.some((i) => i.driver === 'youtube')) fail('search reached past the licensed catalog');

console.log('\n================ publishable catalog ================');
problems.forEach((p) => console.log('✗', p));
if (!problems.length) console.log('✓ every shelf plays from a link that was published for reuse');
console.log(`shelves: ${shelves.length} · items: ${data.total} · problems: ${problems.length}`);
server.kill();
await wait(400);
process.exit(problems.length ? 1 : 0);
