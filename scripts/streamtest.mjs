/* Why do the long talks fail to start? Ask the server for the reason it now sends back. */
const B = 'http://localhost:4780/api';
const EMAIL = 'streamtest@lahn.test';
const PASSWORD = 'stream1234';

const signup = await fetch(`${B}/signup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, name: 'Stream', password: PASSWORD, interests: ['podcasts', 'apodcast', 'quran'] }),
});
let token = (signup.headers.get('set-cookie') ?? '').match(/lahn_token=([^;]+)/)?.[1];
if (!token) {
  const login = await fetch(`${B}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  token = (login.headers.get('set-cookie') ?? '').match(/lahn_token=([^;]+)/)?.[1];
}
const H = { cookie: `lahn_token=${token}` };

const data = await (await fetch(`${B}/shelves`, { headers: H })).json();
const byId = new Map((data.shelves ?? []).map((r) => [r.id, r]));
console.log('total:', data.total, '| shelves:', (data.shelves ?? []).map((r) => `${r.id}:${r.items.length}`).join(' '));

for (const shelf of process.argv.slice(2).length ? process.argv.slice(2) : ['podcasts', 'apodcast']) {
  const items = (byId.get(shelf)?.items ?? []).slice(0, 4);
  for (const item of items) {
    const t0 = Date.now();
    const res = await fetch(`${B}/play/${encodeURIComponent(item.key)}/audio`, { headers: { ...H, range: 'bytes=0-2047' } }).catch((e) => ({ ok: false, status: 'THREW', text: () => Promise.resolve(e.message) }));
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const mins = ((item.duration ?? 0) / 60).toFixed(0);
    if (res.ok || res.status === 206) {
      console.log(`${shelf.padEnd(9)} OK   ${secs}s  ${mins}min  ${item.title.slice(0, 42)}`);
    } else {
      const body = await res.text().catch(() => '');
      console.log(`${shelf.padEnd(9)} ${res.status} ${secs}s  ${mins}min  ${item.title.slice(0, 42)}\n         ${body.slice(0, 260)}`);
    }
  }
}

const del = await fetch(`${B}/me`, { method: 'DELETE', headers: H });
console.log('account removed:', del.status);
