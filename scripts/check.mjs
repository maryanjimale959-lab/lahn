/* Does Laxan actually work end to end? A throwaway listener signs up over the API, waits for
   the shelves to fill, plays one thing off each kind of shelf, searches for a popular Somali
   song and opens an artist. Nothing here touches her own account. */
const B = 'http://localhost:4780/api';
const EMAIL = 'check@lahn.test';
const PASSWORD = 'check1234';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const res = await fetch(`${B}/signup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, name: 'Check', password: PASSWORD, interests: ['music', 'podcasts', 'quran'], terms: true }),
}).catch(() => null);
let token = (res?.headers.get('set-cookie') ?? '').match(/lahn_token=([^;]+)/)?.[1];
if (!token) {
  const login = await fetch(`${B}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  token = (login.headers.get('set-cookie') ?? '').match(/lahn_token=([^;]+)/)?.[1];
}
if (!token) {
  console.log('FAILED to sign in');
  process.exit(1);
}
const H = { cookie: `lahn_token=${token}` };
console.log('signed in as the check account');

let data = null;
for (let n = 0; n < 24; n += 1) {
  data = await (await fetch(`${B}/shelves`, { headers: H })).json();
  const rows = data.shelves ?? [];
  console.log(`  poll ${n + 1}: ready=${data.ready} total=${data.total} rows=${rows.map((s) => `${s.id}:${s.items?.length ?? 0}`).join(' ')}`);
  if (data.ready) break;
  await sleep(10000);
}

console.log('picked:', (data.picked ?? []).join(' ') || 'none');
const rows = data.shelves ?? [];
const byId = new Map(rows.map((row) => [row.id, row]));

for (const want of ['music', 'rap', 'love', 'podcasts', 'quran', 'stories', 'lessons', 'books', 'amusic', 'apodcast']) {
  const item = byId.get(want)?.items?.[0];
  if (!item) {
    console.log(`${want.padEnd(10)} EMPTY`);
    continue;
  }
  const t0 = Date.now();
  const stream = await fetch(`${B}/play/${encodeURIComponent(item.key)}/audio`, {
    headers: { ...H, range: 'bytes=0-4095' },
  }).catch((err) => ({ status: `THREW ${err.message}` }));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${want.padEnd(10)} ${stream.status} in ${secs}s — ${String(item.title).slice(0, 46)}`);
}

const search = await (await fetch(`${B}/search?q=${encodeURIComponent('Knaan wave')}`, { headers: H })).json();
console.log('search "Knaan wave":', (search.catalog ?? []).length, 'catalog hits —', (search.catalog ?? []).slice(0, 3).map((i) => i.title.slice(0, 28)).join(' | '));

const artists = await (await fetch(`${B}/artists`, { headers: H })).json();
console.log('artists:', (artists.artists ?? []).map((a) => `${a.name}(${a.track_count})`).join(' '));

const first = (artists.artists ?? []).find((a) => a.track_count);
if (first) {
  const one = await (await fetch(`${B}/artists/${encodeURIComponent(first.id)}`, { headers: H })).json();
  console.log(`artist ${first.name}: ${(one.items ?? one.tracks ?? []).length} songs — ${(one.items ?? one.tracks ?? []).slice(0, 2).map((t) => t.title.slice(0, 24)).join(' | ')}`);
}

const mine = await (await fetch(`${B}/mine`, { headers: H })).json();
console.log('history:', (mine.history ?? []).map((h) => `${h.title?.slice(0, 18)}[${h.kind ?? '?'}]`).join(' | ') || 'empty');

const del = await fetch(`${B}/me`, { method: 'DELETE', headers: H });
console.log('check account removed:', del.status);
