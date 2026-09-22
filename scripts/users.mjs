/* Which throwaway listeners are still in her database? Read a copy, then leave through the API. */
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SRC = path.resolve('server/data/lahn.db');
const TMP = path.resolve(`.tmp-users-${Date.now()}`);
mkdirSync(TMP, { recursive: true });
/* The copy holds her password hashes, so it goes back out with the process. */
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));
for (const suffix of ['', '-wal']) if (existsSync(SRC + suffix)) copyFileSync(SRC + suffix, path.join(TMP, 'lahn.db' + suffix));

const db = new DatabaseSync(path.join(TMP, 'lahn.db'), { readOnly: true });
const users = db.prepare('SELECT id, email, name FROM users ORDER BY created_at').all();
db.close();
console.log('accounts:', users.length);
for (const u of users) console.log('  ', u.email, '|', u.name, '|', u.id);

const B = 'http://localhost:4780/api';
const TESTS = { 'check@lahn.test': 'check1234', 'streamtest@lahn.test': 'stream1234', 'q@lahn.test': 'query1234', 'preview@lahn.test': 'preview123', 'promo@lahn.test': 'promo1234', 'handoff@lahn.test': 'handoff123' };
for (const [email, password] of Object.entries(TESTS)) {
  const row = users.find((u) => u.email === email);
  if (!row) continue;
  /* The account is deleted through its own route, so the sessions go with it. */
  const login = await fetch(B + '/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const token = (login.headers.get('set-cookie') ?? '').match(/lahn_token=([^;]+)/)?.[1];
  if (!token) {
    console.log(`  ${email}: still there but would not sign in (${login.status})`);
    continue;
  }
  const del = await fetch(B + '/me', { method: 'DELETE', headers: { cookie: `lahn_token=${token}` } });
  console.log(`  ${email}: removed ${del.status}`);
}
