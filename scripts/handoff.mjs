/* Two screens, one session: prove the phone sees what the PC is playing and can take it.
   Run with the dev server up: node scripts/handoff.mjs */
import { chromium } from 'playwright-core';

const BASE = process.env.LAHN_URL ?? 'http://localhost:5173';
const API = 'http://localhost:4780/api';
const problems = [];
const fail = (msg) => problems.push(msg);

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});

const PHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/* Every screen sits behind an account now, so the rig signs one in and takes it back out. */
const RIG = { email: 'handoff@lahn.test', password: 'handoff123', name: 'Rig' };
const tokenOf = (res) => (res.headers.get('set-cookie') ?? '').match(/lahn_token=([^;]+)/)?.[1];
const json = { 'content-type': 'application/json' };
let token = tokenOf(await fetch(`${API}/signup`, { method: 'POST', headers: json, body: JSON.stringify({ ...RIG, interests: ['music'], terms: true }) }));
if (!token) token = tokenOf(await fetch(`${API}/login`, { method: 'POST', headers: json, body: JSON.stringify(RIG) }));
if (!token) {
  console.log('the hand-off rig could not sign in — is the server up?');
  await browser.close();
  process.exit(1);
}

async function screen(name, userAgent, viewport) {
  const ctx = await browser.newContext({ viewport, userAgent });
  await ctx.addCookies([{ name: 'lahn_token', value: token, domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  page.on('pageerror', (err) => problems.push(`[${name}] pageerror: ${err.message.slice(0, 200)}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`[${name}] console: ${msg.text().slice(0, 200)}`);
  });
  /* Her play counts are hers — answered, not blocked, so the console stays clean. */
  await page.route('**/api/tracks/*/play', (route) => route.fulfill({ status: 204, body: '' }));
  await page.goto(`${BASE}/#/songs`, { waitUntil: 'networkidle' });
  return page;
}

const get = (route) => fetch(`${API}${route}`, { headers: { cookie: `lahn_token=${token}` } }).then((r) => r.json());
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (what, fn) => {
  for (let i = 0; i < 40; i += 1) {
    if (await fn()) return true;
    await wait(250);
  }
  fail(`timeout waiting for ${what}`);
  return false;
};

const pc = await screen('pc', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36', { width: 1280, height: 820 });
const phone = await screen('phone', PHONE_UA, { width: 390, height: 844 });

const { tracks } = await get('/tracks');
if (tracks.length < 2) fail('need two tracks in the library');
const queueIds = tracks.slice(0, 3).map((t) => t.id);

/* The PC drives, as if she had just tapped play there. */
await pc.evaluate(
  ({ queueIds: ids }) =>
    fetch('/api/session', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        device: { id: 'pc-fixture', name: 'PC', kind: 'desktop' },
        session: { trackId: ids[0], queueIds: ids, slot: 0, position: 4, playing: true },
      }),
    }),
  { queueIds }
);

await until('the phone to mirror it', async () => (await phone.locator('.elsewhere').count()) > 0);
const shown = await phone.locator('.elsewhere').innerText().catch(() => '');
if (!/Playing on the PC/i.test(shown)) fail(`phone bar did not name the PC: ${JSON.stringify(shown)}`);
if (!shown.includes(tracks[0].title)) fail('phone bar did not show the track title');
if ((await phone.locator('.mini').count()) !== 0) fail('phone showed its own mini player while the PC was driving');

/* Hand-off: one tap and the phone owns playback. */
await phone.locator('.elsewhere').click();
const phoneId = await phone.evaluate(() => localStorage.getItem('lahn.device'));
const claimed = await until('the phone to claim the session', async () => (await get('/session')).session?.device?.id === phoneId);
if (!claimed) fail('the phone never became the driver');
const session = (await get('/session')).session;
if (session.trackId !== tracks[0].id) fail(`hand-off changed the track: ${session.trackId}`);
if (!session.playing) fail('the phone did not start playing after hand-off');
if (session.position < 3) console.log(`note — hand-off restarts the track from ${session.position}s instead of the other screen's place`);
if ((await phone.locator('.elsewhere').count()) !== 0) fail('the phone still mirrors after taking over');
if ((await until('the PC to see the phone', async () => (await pc.locator('.elsewhere').count()) > 0)) === false)
  fail('the PC never showed the phone as the driver');
const pcBar = await pc.locator('.elsewhere').innerText().catch(() => '');
if (!/your phone/i.test(pcBar)) fail(`PC bar did not name the phone: ${JSON.stringify(pcBar)}`);

/* The case that regressed: she does not press "Play here", she taps a different song
   while the other screen is still playing. That tap has to win. */
await phone.reload({ waitUntil: 'networkidle' });
await pc.evaluate(
  ({ queueIds: ids }) =>
    fetch('/api/session', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        device: { id: 'pc-fixture', name: 'PC', kind: 'desktop' },
        session: { trackId: ids[0], queueIds: ids, slot: 0, position: 4, playing: true },
      }),
    }),
  { queueIds }
);
await until('the phone to mirror the PC again', async () => (await phone.locator('.elsewhere').count()) > 0);
await phone.locator('.track').nth(2).click();
const switched = await until('the phone to take the session by tapping', async () => {
  const s = (await get('/session')).session;
  return s?.device?.id === phoneId && s?.playing;
});
if (!switched) fail('tapping a song on the phone left the PC driving');
const after = (await get('/session')).session;
if (after && after.trackId === tracks[0].id) fail('the tap replayed the other screen’s track instead of the one she chose');
if ((await phone.locator('.elsewhere').count()) !== 0) fail('the phone still mirrors after tapping its own song');

await fetch(`${API}/me`, { method: 'DELETE', headers: { ...json, cookie: `lahn_token=${token}` } });

console.log('\n================ hand-off ================');
problems.forEach((p) => console.log(p));
if (!problems.length) console.log(`ok — PC drove ${tracks[0].title.slice(0, 40)}, the phone took it over at ${Math.round(session.position)}s, then took it again by tapping a different song`);
await browser.close();
process.exit(problems.length ? 1 : 0);
