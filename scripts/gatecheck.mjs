/* Can this door be knocked on? Boots a Laxan of its own — its own database, its own port, no
   mail key — and tries the things a stranger would try: sign up from one address over and over,
   skip the terms, fish for which emails are registered, guess a reset code, and sit on a
   forgotten password. Her real library is never opened. */
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, '.tmp-gatecheck');
const DB_FILE = path.join(TMP, 'data', 'lahn.db');
const PORT = 4795;
const API = `http://localhost:${PORT}/api`;

const problems = [];
const fail = (line) => problems.push(line);
const ok = (line) => console.log(`  ✓ ${line}`);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

rmSync(TMP, { recursive: true, force: true });

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    LAHN_PORT: String(PORT),
    LAHN_DATA: path.join(TMP, 'data'),
    LAHN_LIBRARY: path.join(TMP, 'library'),
  },
});
const boot = [];
server.stdout.on('data', (c) => boot.push(String(c)));
server.stderr.on('data', (c) => boot.push(String(c)));
const tidy = () => {
  server.kill();
  try {
    rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {
    /* Windows holds the folder a moment after the process inside it dies. */
  }
};
process.on('exit', tidy);
process.on('SIGINT', () => process.exit(1));

const call = async (route, body, headers) => {
  const res = await fetch(API + route, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  }).catch((e) => ({ status: 0, headers: new Map(), json: () => ({}), threw: e.message }));
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: res.headers?.get?.('set-cookie') ?? '' };
};

const tokenOf = (cookie) => cookie.match(/lahn_token=([^;]+)/)?.[1] ?? null;

for (let n = 0; n < 60; n += 1) {
  const up = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (up?.ok) break;
  await wait(1000);
}
const health = await (await fetch(`${API}/health`)).json().catch(() => ({}));
console.log('a throwaway Laxan, with no email key configured…\n');
if (health.mail !== false) fail('health should say no mail service is configured on this instance');

/* ---------- the terms line ---------- */

const noTerms = await call('/signup', { email: 'a@lahn.test', name: 'A', password: 'secret123', interests: ['music'] });
if (noTerms.status === 400 && noTerms.data.error === 'terms-required') ok('an account cannot be made by skipping the terms');
else fail(`sign-up without the terms box answered ${noTerms.status} ${JSON.stringify(noTerms.data)}`);

const first = await call('/signup', { email: 'a@lahn.test', name: 'A', password: 'secret123', interests: ['music'], terms: true });
if (first.status === 201 && tokenOf(first.cookie)) ok('and it goes through the moment you accept them');
else fail(`a signed-up listener could not get in: ${first.status} ${JSON.stringify(first.data)}`);

/* ---------- rate limits ---------- */

let blocked = 0;
for (let n = 0; n < 6; n += 1) {
  const res = await call('/signup', { email: `x${n}@lahn.test`, name: 'X', password: 'secret123', interests: ['music'], terms: true });
  if (res.status === 429) blocked += 1;
}
if (blocked) ok(`the third account from one address in an hour is refused (${blocked} of 6 knocked back)`);
else fail('six accounts were minted from one address — the signup gate is not holding');

/* ---------- the code that comes back for a forgotten password ---------- */

const known = await call('/forgot', { email: 'a@lahn.test' });
const ghost = await call('/forgot', { email: 'nobody-at-all@lahn.test' });
if (known.status === 200 && ghost.status === 200 && JSON.stringify(known.data) === JSON.stringify(ghost.data))
  ok('asking for a code answers the same whether or not the address is registered');
else fail(`the forgot form leaks which emails exist: ${JSON.stringify(known.data)} vs ${JSON.stringify(ghost.data)}`);

const db = new DatabaseSync(DB_FILE, { readOnly: true });
const row = db.prepare("SELECT * FROM password_resets WHERE email = 'a@lahn.test'").get();
const ghostRow = db.prepare("SELECT * FROM password_resets WHERE email = 'nobody-at-all@lahn.test'").get();
db.close();
if (!row) fail('no code was written out for the registered address');
if (ghostRow) fail('a code was written for an address with no account');
if (row) {
  const mins = Math.round((row.expires_at - Date.now()) / 60000);
  if (/^[0-9a-f]{128}$/.test(row.code_hash) && mins > 18 && mins <= 20) ok(`the code is stored hashed and dies in ${mins} minutes`);
  else fail(`the reset row looks wrong: hash ${String(row.code_hash).slice(0, 12)}…, ${mins} minutes left`);
}

const badGuess = await call('/reset', { email: 'a@lahn.test', code: '000123', password: 'brand-new-1' });
if (badGuess.status === 400 && badGuess.data.error === 'bad-code') ok('a wrong code is refused, and the account stays shut');
else fail(`a wrong reset code answered ${badGuess.status} ${JSON.stringify(badGuess.data)}`);

const shortPw = await call('/reset', { email: 'a@lahn.test', code: '000123', password: 'abc' });
if (shortPw.data.error === 'short-password') ok('and a too-short new password is refused before the code is spent');
else fail(`a six-character floor is not being enforced: ${JSON.stringify(shortPw.data)}`);

let burned = null;
for (let n = 0; n < 6; n += 1) {
  burned = await call('/reset', { email: 'a@lahn.test', code: '111111', password: 'brand-new-1' });
  if (burned.status === 429 || burned.data.error === 'try-later') break;
}
if (burned.status === 429 || burned.data.error === 'try-later') ok('five guesses later the code is burned, not left standing');
else fail(`a code survived six wrong guesses: ${burned.status} ${JSON.stringify(burned.data)}`);

/* ---------- the way in when there is no mail key ---------- */

const cli = spawn(process.execPath, ['src/reset-password.js', 'a@lahn.test'], {
  cwd: path.join(ROOT, 'server'),
  windowsHide: true,
  env: { ...process.env, LAHN_DATA: path.join(TMP, 'data'), LAHN_LIBRARY: path.join(TMP, 'library'), LAHN_PORT: String(PORT) },
});
let printed = '';
cli.stdout.on('data', (c) => (printed += String(c)));
cli.stderr.on('data', (c) => (printed += String(c)));
await new Promise((done) => cli.on('exit', done));
const issued = /\n\s{4}([A-Za-z0-9_-]{10,})\n/.exec(printed)?.[1];
if (issued) ok('npm run reset-password hands out a password from the PC itself');
else fail(`the reset CLI printed no password:\n${printed.slice(0, 400)}`);

if (issued) {
  const reIn = await call('/login', { email: 'a@lahn.test', password: issued });
  if (reIn.status === 200) ok('and signing in with it works');
  else fail(`the password the CLI printed did not work: ${reIn.status}`);

  const oldToken = tokenOf(first.cookie);
  const oldSession = await fetch(`${API}/me`, { headers: { cookie: `lahn_token=${oldToken}` } });
  const body = await oldSession.json().catch(() => ({}));
  if (oldSession.status === 200 && body.user) fail('the session signed in before the reset is still alive');
  else ok('every device that held the old password was thrown out with it');
}

let fished = null;
for (let n = 0; n < 4; n += 1) fished = await call('/forgot', { email: 'a@lahn.test' });
if (fished.status === 429) ok('and one address cannot go on asking for codes all afternoon');
else fail(`four code requests for one address were all accepted: ${fished.status}`);

/* The per-address lock in auth.js stops at eight tries, so this walks ten addresses three tries
   each — the only wall left standing is the one that counts the machine knocking. */
let knocked = 0;
outer: for (let a = 0; a < 12; a += 1) {
  for (let n = 0; n < 3; n += 1) {
    const res = await call('/login', { email: `probe${a}@lahn.test`, password: 'not-it-at-all' });
    if (res.status === 429) {
      knocked = a * 3 + n + 1;
      break outer;
    }
  }
}
if (knocked) ok(`thirty wrong passwords from one machine is a walk, not a login: stopped at ${knocked}`);
else fail('36 wrong passwords across twelve addresses were all answered individually');

console.log(`\nserver said:\n${boot.join('').split('\n').filter((l) => /warn|error/i.test(l)).slice(0, 6).join('\n') || '  (nothing alarming)'}`);
console.log('\n================ doors and windows ================');
problems.forEach((p) => console.log('✗', p));
if (!problems.length) console.log('✓ sign-up, log-in and password reset all hold against a stranger');
console.log(`problems: ${problems.length}`);
server.kill();
await wait(400);
process.exit(problems.length ? 1 : 0);
