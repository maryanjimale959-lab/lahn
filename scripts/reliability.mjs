/* Does the catalogue hold up when a source stops answering? Boots a Laxan of its own — its own
   database, its own library folder, its own port — on the published-catalogue setting, times how
   long the first open takes, then breaks one source on purpose and watches the app notice it, back
   off, and let it recover. Her real library is never opened. */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, `.tmp-reliability-${Date.now()}`);
const DB_FILE = path.join(TMP, 'data', 'lahn.db');
const PORT = 4796;
const API = `http://localhost:${PORT}/api`;
const DEAD = 'https://127.0.0.1:9/nothing-here.xml';

const problems = [];
const ok = (line) => console.log('✓', line);
const fail = (line) => problems.push(line);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

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
const boot = [];
server.stdout.on('data', (c) => boot.push(String(c)));
server.stderr.on('data', (c) => boot.push(String(c)));

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

const json = async (p, init) => {
  const res = await fetch(API + p, init);
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

async function until(what, check, { tries = 90, every = 1000 } = {}) {
  for (let n = 0; n < tries; n += 1) {
    if (await check().catch(() => null)) return true;
    await wait(every);
  }
  fail(`timed out waiting for ${what}`);
  return false;
}

console.log('booting a throwaway Laxan and timing its first open…\n');
const started = Date.now();
if (!(await until('it to come up', async () => (await json('/health')).body.ok))) process.exit(1);

/* ---------- how long the catalogue takes to arrive ---------- */

let cold = null;
await until('the shelves to fill', async () => {
  const { body } = await json('/shelves');
  if (body.ready) {
    cold = Date.now() - started;
    return true;
  }
  return false;
});
if (cold === null) process.exit(1);

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA busy_timeout = 5000');
const staleAll = () => db.prepare('UPDATE channels SET fetched_at = NULL').run();

const health = (await json('/health')).body;
const total = health.sources?.total ?? 0;
const channels = ((await json('/channels')).body.channels ?? []).filter((c) => c.licensed);
console.log(`first open: ${(cold / 1000).toFixed(1)}s · ${total} sources, ${channels.length} of them feeds and recitation servers\n`);
if (health.sources.failing === 0) ok('every source answered on the first sweep');
else fail(`${health.sources.failing} source(s) failed on a sweep that should have been clean`);

/* The same work twice, on a database whose artwork is already cached from that first open so the
   only difference is the order the sources are asked in: the sweep Laxan actually runs, then the
   same sources one after the other for the number it replaces. */
staleAll();
const togetherAt = Date.now();
await json('/channels/refresh-all', { method: 'POST' });
const together = Date.now() - togetherAt;

staleAll();
const apartAt = Date.now();
for (const c of channels) await json(`/channels/${c.id}/refresh`, { method: 'POST' });
const apart = Date.now() - apartAt;

console.log(`asking ${channels.length} sources: ${(together / 1000).toFixed(1)}s in the sweep · ${(apart / 1000).toFixed(1)}s one after the other`);
if (together < apart / 2) ok(`the sweep runs beside itself — ${(apart / together).toFixed(1)}× faster than one source at a time`);
else fail(`the sweep still queues: ${together}ms against ${apart}ms one by one`);

/* ---------- break one source on purpose ---------- */

const victim = channels.find((c) => c.driver === 'rss');
const before = victim.url;
const set = (url) => db.prepare('UPDATE channels SET url = ? WHERE id = ?').run(url, victim.id);

set(DEAD);
const broken = await json(`/channels/${victim.id}/refresh`, { method: 'POST' });
if (broken.status >= 400) ok('a source that will not answer comes back as an error, not as an empty shelf');
else fail(`refreshing a dead link reported success: ${broken.status}`);

const after = ((await json('/channels')).body.channels ?? []).find((c) => c.id === victim.id);
if (after.health === 'failing' && after.fails === 1 && after.lastError) ok(`the app knows it: ${after.name} — "${after.lastError.slice(0, 46)}"`);
else fail(`the broken source was not recorded: ${JSON.stringify({ health: after.health, fails: after.fails, lastError: after.lastError })}`);

for (let n = 0; n < 2; n += 1) await json(`/channels/${victim.id}/refresh`, { method: 'POST' });
const worn = ((await json('/channels')).body.channels ?? []).find((c) => c.id === victim.id);
if (worn.fails === 3) ok('and each refusal is counted, so the shelf can say how long it has been quiet');
else fail(`refusals did not add up: ${worn.fails}`);
/* What she still gets while it is quiet: the list it gave before it went. */
if (worn.uploadCount > 0) ok(`its ${worn.uploadCount} listings still play while it is out`);
else fail('a source that once answered lost its listings while it was down');

/* A link that has never answered at all is a different thing to say than one that stopped. */
db.prepare('UPDATE channels SET fetched_at = NULL WHERE id = ?').run(victim.id);
const never = ((await json('/channels')).body.channels ?? []).find((c) => c.id === victim.id);
if (never.health === 'dead') ok('a source that never answered reads as dead, not as merely slow');
else fail(`a never-answered source read as ${never.health}`);

/* The backoff: a source that just refused is not due again for ten minutes, so the next sweep has
   nothing to do and comes straight back. */
const idle = (await json('/health')).body.sources;
const sweptAt = Date.now();
await json('/channels/refresh-all', { method: 'POST' });
const swept = Date.now() - sweptAt;
if (idle.due === 0 && idle.failing === 1 && swept < 4000) ok(`the refresh cycle leaves it alone for a while (${swept}ms to sweep, ${idle.due} source(s) due)`);
else fail(`a refusing source is still being hammered: due=${idle.due} failing=${idle.failing} sweep=${swept}ms`);

/* ---------- and put it back ---------- */

set(before);
const back = await json(`/channels/${victim.id}/refresh`, { method: 'POST' });
const healed = ((await json('/channels')).body.channels ?? []).find((c) => c.id === victim.id);
if (back.status === 200 && healed.health === 'ok' && healed.fails === 0 && healed.uploadCount > 0) {
  ok(`fixing the link brings it back on the next check — ${healed.uploadCount} items again`);
} else {
  fail(`the source did not recover: ${back.status} ${JSON.stringify({ health: healed.health, fails: healed.fails, items: healed.uploadCount })}`);
}
db.close();

const clean = (await json('/health')).body.sources;
if (clean.dead === 0 && clean.total === total) ok('the catalogue ends as whole as it started');
else fail(`sources were lost on the way: ${JSON.stringify(clean)}`);

/* The refusals below are the broken link on purpose; everything else is worth reading. */
const alarming = boot.join('').split('\n').filter((l) => /error|throw|unhandled/i.test(l) && !/fetch failed|nothing-here/.test(l));
console.log(`\nserver said:\n${alarming.slice(0, 5).join('\n') || '  (nothing alarming)'}`);
console.log('\n================ the catalogue holds up ================');
problems.forEach((p) => console.log('✗', p));
if (!problems.length) console.log('✓ a cold open is quick, and a dead source is noticed, rested and recovered');
console.log(`problems: ${problems.length}`);
process.exit(problems.length ? 1 : 0);
