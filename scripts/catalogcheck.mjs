/* Do the artists and the search box answer? A throwaway listener asks, then leaves. */
const B = 'http://localhost:4780/api';
const EMAIL = 'q@lahn.test';
const PASSWORD = 'query1234';

const call = async (path, init) => {
  const res = await fetch(B + path, init).catch((e) => ({ status: 'THREW ' + e.message, json: () => ({}) }));
  return res;
};

let signup = await call('/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, name: 'Q', password: PASSWORD, interests: ['music'] }) });
let token = (signup.headers?.get?.('set-cookie') ?? '').match(/lahn_token=([^;]+)/)?.[1];
if (!token) {
  const login = await call('/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  token = (login.headers?.get?.('set-cookie') ?? '').match(/lahn_token=([^;]+)/)?.[1];
}
if (!token) {
  console.log('no token');
  process.exit(1);
}
const H = { cookie: `lahn_token=${token}` };

for (const q of ['Knaan', 'Hodan Abdirahman', 'hees cusub', 'Amoon']) {
  const s = await (await call(`/search?q=${encodeURIComponent(q)}`, { headers: H })).json();
  const hits = s.catalog ?? [];
  console.log(`search "${q}": ${hits.length} hits — ${hits.slice(0, 3).map((i) => `${i.title.slice(0, 30)}[${i.shelf ?? 'live'}]`).join(' | ')}`);
}

const artists = await (await call('/artists', { headers: H })).json();
const list = artists.artists ?? [];
console.log(`\nartists (${list.length}):`, list.map((a) => `${a.name}:${a.track_count}`).join(' '));

if (list.length) {
  const one = await (await call(`/artists/${encodeURIComponent(list[0].id)}`, { headers: H })).json();
  const items = one.items ?? one.tracks ?? [];
  console.log(`\nartist page ${list[0].name}: ${items.length} songs — ${items.slice(0, 3).map((i) => i.title.slice(0, 34)).join(' | ')}`);
}

const del = await call('/me', { method: 'DELETE', headers: H });
console.log('\naccount removed:', del.status);
