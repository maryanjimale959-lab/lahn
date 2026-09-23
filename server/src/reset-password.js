/* Whoever can sit at this PC owns the accounts on it. This is the way back in when no email key
   is configured — or when the inbox a code would go to is gone: it prints a one-time password and
   signs every other device out, so the old password stops working everywhere at once. */
import { randomBytes } from 'node:crypto';
import { closeDb, get } from './db.js';
import { setPassword } from './auth.js';
import { log } from './log.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const arg = String(process.argv[2] ?? '').trim().toLowerCase();

if (!EMAIL.test(arg)) {
  log.info('usage', 'npm run reset-password you@example.com');
  const any = get('SELECT COUNT(*) AS n FROM users').n;
  if (any) log.info('accounts', `${any} on this machine — scripts/users.mjs lists them`);
  process.exit(2);
}

const password = randomBytes(9).toString('base64url');
const user = setPassword(arg, password);
if (!user) {
  log.error(`Laxan has no account for ${arg}`);
  process.exit(1);
}

log.ok(`${user.name} <${user.email}> can now sign in with:`);
console.log(`\n    ${password}\n`);
log.info('next', 'change it in Settings once you are in; every other device was signed out.');
closeDb();
