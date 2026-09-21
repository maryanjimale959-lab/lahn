#!/usr/bin/env node
/**
 * Brand posters for social media — the reference-style promo shots.
 *
 *   node scripts/promo.mjs
 *
 * The phone mockups are not drawings: they are her real app screens captured from the
 * running Lahn server, so the poster shows what the product actually looks like.
 * Requires `npm start` (or `npm run dev`) to be serving the app.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'share');
const SHOTS = path.join(OUT, 'screens');
const TMP = path.join(OUT, '.promo');
const BASE = process.env.LAHN_URL || 'http://localhost:4780';

/* ------------------------------------------------------------------ art */

const FONTS = [
  ['Manrope', 'manrope', 'manrope-latin'],
  ['Manrope', 'manrope', 'manrope-latin-ext'],
  ['Manrope', 'manrope', 'manrope-vietnamese'],
  ['Noto Kufi Arabic', 'noto-kufi-arabic', 'noto-kufi-arabic-arabic'],
  ['Noto Kufi Arabic', 'noto-kufi-arabic', 'noto-kufi-arabic-latin'],
]
  .map(([family, pkg, subset]) => {
    const file = path.join(ROOT, 'node_modules', '@fontsource-variable', pkg, 'files', `${subset}-wght-normal.woff2`);
    return `@font-face{font-family:'${family}';font-weight:100 900;font-style:normal;src:url('${pathToFileURL(file)}') format('woff2-variations');}`;
  })
  .join('\n');

const THEME = {
  dark: { bg: '#0d0c10', ink: '#f4f2ef', mute: '#9b97a3', card: '#17161c', line: 'rgba(244,242,239,.14)', glowA: 'rgba(224,82,63,.55)', glowB: 'rgba(74,157,163,.34)', grain: '.30' },
  light: { bg: '#f4efe9', ink: '#171419', mute: '#6d6774', card: '#ffffff', line: 'rgba(23,20,25,.14)', glowA: 'rgba(255,157,92,.65)', glowB: 'rgba(120,205,197,.5)', grain: '.16' },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dataUri = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;

function logoMark(size) {
  return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <radialGradient id="pm-disc" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#3a3740"/><stop offset=".55" stop-color="#141317"/><stop offset="1" stop-color="#08080a"/></radialGradient>
      <linearGradient id="pm-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf6ee"/><stop offset="1" stop-color="#f0d9c7"/></linearGradient>
    </defs>
    <rect width="64" height="64" rx="15" fill="url(#pm-bg)"/>
    <circle cx="27" cy="37" r="20" fill="url(#pm-disc)"/>
    <circle cx="27" cy="37" r="8" fill="#e0523f"/>
    <circle cx="27" cy="37" r="1.5" fill="#f2f1ee"/>
    <g fill="#26242b"><circle cx="49" cy="17" r="4.6"/><rect x="47.4" y="17" width="3.2" height="17" rx="1.6" transform="rotate(24 49 25)"/></g>
  </svg>`;
}

/** The oversized record that bleeds off the edge of every poster. */
function bigDisc(t) {
  const grooves = Array.from({ length: 16 }, (_, i) => 470 - i * 27)
    .map((r) => `<circle cx="500" cy="500" r="${r}" fill="none" stroke="#ffffff" stroke-opacity=".075" stroke-width="2"/>`)
    .join('');
  return `<svg viewBox="0 0 1000 1000" aria-hidden="true">
    <defs>
      <radialGradient id="bd" cx="34%" cy="24%" r="88%"><stop offset="0" stop-color="#453f4b"/><stop offset=".52" stop-color="#16141a"/><stop offset="1" stop-color="#07070a"/></radialGradient>
      <linearGradient id="bl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9d5c"/><stop offset="1" stop-color="#e0523f"/></linearGradient>
    </defs>
    <circle cx="500" cy="500" r="500" fill="url(#bd)"/>
    ${grooves}
    <circle cx="500" cy="500" r="180" fill="url(#bl)"/>
    <circle cx="500" cy="500" r="180" fill="${t.bg}" fill-opacity=".18"/>
    <circle cx="500" cy="500" r="26" fill="${t.bg}"/>
  </svg>`;
}

/* The app's own transport icons, so the card on the poster is the real control row. */
const ST = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const FL = 'fill="currentColor"';
const svg = (body, opts) => `<svg viewBox="0 0 24 24" ${opts}>${body}</svg>`;
const icon = {
  play: svg('<path d="M8 5.4l11 6.6-11 6.6z"/>', FL),
  pause: svg('<rect x="7" y="5" width="3.6" height="14" rx="1.4"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.4"/>', FL),
  prev: svg('<path d="M18 6l-9 6 9 6z"/><rect x="5" y="6" width="2.4" height="12" rx="1.2"/>', FL),
  next: svg('<path d="M6 6l9 6-9 6z"/><rect x="16.6" y="6" width="2.4" height="12" rx="1.2"/>', FL),
  shuffle: svg('<path d="M3 7h3.6c1.4 0 2.2.7 3 1.9l4.2 6.2c.8 1.2 1.6 1.9 3 1.9H21"/><path d="M3 17h3.6c1.4 0 2.2-.7 3-1.9l.9-1.3"/><path d="M14.2 8.5l.9-1.3c.8-1.2 1.6-1.9 3-1.9H21"/><path d="M18.4 3.2L21 5.3l-2.6 2.1M18.4 13.2L21 15.3l-2.6 2.1"/>', ST),
  repeat: svg('<path d="M6.5 7.5h9.8c1.7 0 3 1.3 3 3v1"/><path d="M17.5 5.5l2 2-2 2"/><path d="M17.5 16.5H7.7c-1.7 0-3-1.3-3-3v-1"/><path d="M6.5 18.5l-2-2 2-2"/>', ST),
};

const statusBar = (t) => `<div class="status" style="color:${t.ink}">
    <b>12:47</b>
    <svg viewBox="0 0 74 16" width="74" height="16" aria-hidden="true">
      <g fill="currentColor"><rect x="0" y="9" width="3.5" height="7" rx="1"/><rect x="5.5" y="6.5" width="3.5" height="9.5" rx="1"/><rect x="11" y="4" width="3.5" height="12" rx="1"/><rect x="16.5" y="1.5" width="3.5" height="14.5" rx="1"/></g>
      <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M27 8.4a10 10 0 0 1 13 0M30 11.6a6 6 0 0 1 7 0"/></g>
      <circle cx="33.5" cy="14.4" r="1.3" fill="currentColor"/>
      <g><rect x="46" y="2.5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" stroke-opacity=".5"/><rect x="48" y="4.5" width="15" height="7" rx="2" fill="currentColor"/><rect x="69.5" y="6" width="2" height="4" rx="1" fill="currentColor" fill-opacity=".5"/></g>
    </svg>
  </div>`;

/** A captured screen, dropped into a phone bezel. */
function phone(src, t, cls = '') {
  return `<div class="phone ${cls}"><div class="frame"><div class="screen">
      ${statusBar(t)}<img src="${src}" alt=""/>
    </div></div></div>`;
}

/* ----------------------------------------------------------------- data */

function heroTrack(id) {
  const db = new DatabaseSync(path.join(ROOT, 'server', 'data', 'lahn.db'), { readOnly: true });
  const row = db
    .prepare(
      id
        ? `SELECT title, duration, cover, a.name AS artist FROM tracks t LEFT JOIN artists a ON a.id = t.artist_id WHERE t.id = ?`
        : `SELECT title, duration, cover, a.name AS artist FROM tracks t LEFT JOIN artists a ON a.id = t.artist_id ORDER BY t.plays DESC, t.added_at DESC LIMIT 1`
    )
    .get(...(id ? [id] : []));
  const count = db.prepare('SELECT COUNT(*) n FROM tracks').get().n;
  db.close();
  if (!row) throw new Error('the library is empty — add a song first');
  const cover = row.cover && existsSync(path.join(ROOT, 'library', row.cover))
    ? `data:image/jpeg;base64,${readFileSync(path.join(ROOT, 'library', row.cover)).toString('base64')}`
    : null;
  return { title: row.title, artist: row.artist ?? 'Unknown artist', duration: Number(row.duration) || 0, cover, count };
}

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const HEAD = (process.env.POSTER_HEAD || 'Own Your Sound').split(/\s+/).slice(0, 4);
const LEDE =
  process.env.POSTER_LEDE ||
  'Paste a link and <b>keep the song</b>. Lahn plays your library on your PC and your phone — <b>offline, ad‑free, no subscription</b>.';

/* -------------------------------------------------------------- capture */

const SCREENS = [
  { id: 'home', route: '#/home', wait: '.tile' },
  { id: 'songs', route: '#/songs', wait: '.track' },
  { id: 'deck', route: '#/songs', wait: '.now .deck', play: true },
  { id: 'search', route: '#/search', wait: '.topbar', close: true },
];

async function capture(browser, theme) {
  mkdirSync(SHOTS, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  /* Her play counts are hers — the /play ping is dropped so a poster shoot never inflates them. */
  await page.route('**/api/tracks/*/play', (route) => route.abort());
  await page.addInitScript((name) => localStorage.setItem('lahn.theme', name), theme);
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' });

  const files = {};
  let playing = null;
  /* The deck screen plays whatever the songs list puts first, so the poster's player card
     reads that track's id off its audio request — card and phone must never disagree. */
  page.on('request', (req) => {
    const hit = req.url().match(/\/api\/tracks\/([^/]+)\/audio/);
    if (hit) playing = hit[1];
  });
  for (const screen of SCREENS) {
    await page.goto(`${BASE}/${screen.route}`, { waitUntil: 'networkidle' });
    if (screen.play) {
      await page.waitForSelector('.track');
      await page.click('.track');
      await page.waitForSelector('.mini');
      await page.click('.mini');
    }
    await page.waitForSelector(screen.wait, { timeout: 15000 });
    if (screen.close) {
      /* The sheet is app state, not a route, so it rides along onto the next page until closed. */
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.now'));
    }
    if (screen.play) {
      /* The sheet slides up over 0.42s; shooting mid-flight catches the list still behind it. */
      await page.waitForFunction(() => document.querySelector('.now')?.getBoundingClientRect().top <= 1);
      /* Let it actually run a while — a poster player frozen at 0:00 reads as a screenshot, not a song. */
      await page.waitForTimeout(20000);
    }
    await page.waitForTimeout(700);
    const file = path.join(SHOTS, `${screen.id}-${theme}.png`);
    await page.screenshot({ path: file });
    files[screen.id] = dataUri(file);
    if (screen.play) {
      const [m, sec] = (await page.textContent('.now .times span')).split(':').map(Number);
      playing = { id: playing, elapsed: (m || 0) * 60 + (sec || 0) };
    }
    console.log('captured', path.relative(ROOT, file));
  }
  await page.close();
  return { files, playing };
}

/* --------------------------------------------------------------- poster */

function playerCard(hero, t) {
  const elapsed = hero.elapsed ?? hero.duration * 0.34;
  const at = Math.max(4, Math.min(96, (elapsed / (hero.duration || 1)) * 100));
  return `<div class="card">
    ${hero.cover ? `<img class="art" src="${hero.cover}" alt=""/>` : '<div class="art blank"></div>'}
    <div class="body">
      <div class="who"><b>${esc(hero.title)}</b><span>${esc(hero.artist)}</span></div>
      <div class="bar"><i style="width:${at}%"></i></div>
      <div class="times"><span>${mmss(elapsed)}</span><span>${mmss(hero.duration)}</span></div>
      <div class="ctl">${icon.shuffle}${icon.prev}${icon.pause}${icon.next}${icon.repeat}</div>
    </div>
  </div>`;
}

function story(f, shots, hero) {
  const t = THEME[f.theme];
  /* The headline is one word per line, so size it from the longest word rather than hard-coding. */
  const headFont = Math.max(96, Math.min(180, Math.round(1120 / Math.max(...HEAD.map((w) => w.length)))));
  const head = `${HEAD.slice(0, -1).join('<br>')}${HEAD.length > 1 ? '<br>' : ''}<em>${HEAD.at(-1)}</em>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{font-family:'Manrope','Noto Kufi Arabic',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.poster{position:relative;width:1080px;height:1920px;background:${t.bg};color:${t.ink};overflow:hidden}
.glow{position:absolute;border-radius:50%;filter:blur(120px)}
.g1{width:900px;height:900px;left:-300px;top:-260px;background:${t.glowA}}
.g2{width:760px;height:760px;right:-260px;bottom:-200px;background:${t.glowB}}
.disc{position:absolute;width:1180px;height:1180px;right:-430px;top:300px;opacity:.9}
.disc svg{width:100%;height:100%}
.grain{position:absolute;inset:0;mix-blend-mode:soft-light;opacity:${t.grain}}
.brand{position:absolute;left:76px;top:84px;display:flex;align-items:center;gap:20px}
.brand .mark{border-radius:18px;box-shadow:0 14px 34px rgba(0,0,0,.28)}
.word{display:flex;align-items:baseline;gap:12px}
.word b{font-size:54px;font-weight:800;letter-spacing:-.045em}
.word span{font-family:'Noto Kufi Arabic',sans-serif;font-size:30px;font-weight:600;color:${t.mute}}
.nav{position:absolute;left:80px;top:206px;display:flex;gap:38px;font-size:26px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:${t.mute}}
.nav i{font-style:normal;color:${t.ink}}
h1{position:absolute;right:74px;top:300px;width:600px;text-align:right;font-size:${headFont}px;font-weight:800;line-height:.86;letter-spacing:-.055em}
h1 em{font-style:normal;color:#e0523f}
.lede{position:absolute;left:80px;top:396px;width:392px;font-size:32px;line-height:1.5;font-weight:500;color:${t.mute}}
.lede b{color:${t.ink};font-weight:700}
.card{position:absolute;left:76px;top:1010px;width:700px;background:${t.card};border-radius:34px;padding:34px;display:flex;gap:30px;
  box-shadow:0 40px 80px rgba(0,0,0,.42);border:1px solid ${t.line}}
.art{width:196px;height:196px;border-radius:20px;object-fit:cover;flex:none;box-shadow:0 16px 30px rgba(0,0,0,.35)}
.art.blank{background:linear-gradient(140deg,#ff9d5c,#e0523f)}
.body{flex:1;min-width:0;display:flex;flex-direction:column}
.who{display:grid;gap:6px}
.who b{font-size:31px;font-weight:800;letter-spacing:-.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.who span{font-size:26px;font-weight:500;color:${t.mute};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{margin-top:26px;height:8px;border-radius:99px;background:${t.line};position:relative}
.bar i{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#ff9d5c,#e0523f)}
.times{display:flex;justify-content:space-between;margin-top:12px;font-size:22px;font-weight:600;color:${t.mute};font-variant-numeric:tabular-nums}
.ctl{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:44px;color:${t.ink}}
.ctl svg{width:44px;height:44px}
.ctl svg:nth-child(1),.ctl svg:nth-child(5){width:34px;height:34px;color:${t.mute}}
.ctl svg:nth-child(3){width:66px;height:66px}
.phone{position:absolute;right:64px;top:800px;width:400px;transform:rotate(4deg);transform-origin:top right}
.frame{border-radius:60px;padding:14px;background:linear-gradient(155deg,#4b4852,#131217 42%,#33313a);box-shadow:0 60px 90px rgba(0,0,0,.5),inset 0 0 0 2px rgba(255,255,255,.12)}
.screen{border-radius:48px;overflow:hidden;background:${t.bg}}
.screen img{display:block;width:100%}
.status{display:flex;align-items:center;justify-content:space-between;padding:22px 34px 12px;font-size:26px;font-weight:700}
.foot{position:absolute;left:80px;right:80px;bottom:76px;display:flex;align-items:center;justify-content:space-between;
  padding-top:30px;border-top:1px solid ${t.line};font-size:26px;font-weight:700;letter-spacing:.06em;color:${t.mute}}
.foot b{color:${t.ink}}
.foot .ar{font-family:'Noto Kufi Arabic',sans-serif}
</style></head>
<body><div class="poster">
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="disc">${bigDisc(t)}</div>
  <div class="brand">${logoMark(84)}<span class="word"><b>Lahn</b><span dir="rtl">لحن</span></span></div>
  <div class="nav"><i>Songs</i><span>Artists</span><span>Albums</span><span>Playlists</span></div>
  <h1>${head}</h1>
  <p class="lede">${LEDE}</p>
  ${phone(shots.deck, t)}
  ${playerCard(hero, t)}
  <div class="foot"><span><b>${hero.count} songs</b> · no ads · no subscription · yours offline</span><span class="ar">lahn · <bdi dir="rtl">لحن</bdi></span></div>
  <svg class="grain"><filter id="gr"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="4"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#gr)"/></svg>
</div></body></html>`;
}

function showcase(f, shots, hero) {
  const t = THEME[f.theme];
  const ids = ['home', 'songs', 'deck', 'search'];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1080px;overflow:hidden}
body{font-family:'Manrope','Noto Kufi Arabic',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.poster{position:relative;width:1080px;height:1080px;background:${t.bg};color:${t.ink};overflow:hidden}
.glow{position:absolute;border-radius:50%;filter:blur(110px)}
.g1{width:820px;height:820px;left:-260px;top:-300px;background:${t.glowA}}
.g2{width:700px;height:700px;right:-220px;bottom:-240px;background:${t.glowB}}
.watermark{position:absolute;left:0;right:0;top:330px;text-align:center;font-size:290px;font-weight:800;letter-spacing:-.06em;
  color:${t.ink};opacity:.07;line-height:1}
.disc{position:absolute;width:520px;height:520px;left:-150px;bottom:-140px;opacity:.85}
.disc svg{width:100%;height:100%}
.grain{position:absolute;inset:0;mix-blend-mode:soft-light;opacity:${t.grain}}
.brand{position:absolute;left:64px;top:56px;display:flex;align-items:center;gap:16px}
.brand .mark{border-radius:14px;box-shadow:0 12px 28px rgba(0,0,0,.26)}
.word{display:flex;align-items:baseline;gap:10px}
.word b{font-size:40px;font-weight:800;letter-spacing:-.045em}
.word span{font-family:'Noto Kufi Arabic',sans-serif;font-size:23px;font-weight:600;color:${t.mute}}
.tag{position:absolute;right:64px;top:70px;max-width:430px;text-align:right;font-size:25px;line-height:1.45;font-weight:600;color:${t.mute}}
.tag b{color:${t.ink}}
.row{position:absolute;left:0;right:0;top:252px;display:flex;justify-content:center;align-items:flex-start;gap:22px}
.phone{width:228px;flex:none}
.phone:nth-child(2),.phone:nth-child(3){transform:translateY(-46px)}
.phone:nth-child(1){transform:translateY(26px) rotate(-2deg)}
.phone:nth-child(4){transform:translateY(26px) rotate(2deg)}
.frame{border-radius:38px;padding:9px;background:linear-gradient(155deg,#4b4852,#131217 42%,#33313a);box-shadow:0 40px 70px rgba(0,0,0,.45),inset 0 0 0 2px rgba(255,255,255,.12)}
.screen{border-radius:31px;overflow:hidden;background:${t.bg}}
.screen img{display:block;width:100%}
.status{display:flex;align-items:center;justify-content:space-between;padding:13px 20px 7px;font-size:15px;font-weight:700}
.status svg{width:44px;height:10px}
.labels{position:absolute;left:64px;right:64px;top:826px;display:flex;justify-content:space-between;font-size:22px;font-weight:700;
  letter-spacing:.10em;text-transform:uppercase;color:${t.mute}}
.foot{position:absolute;left:64px;right:64px;bottom:56px;display:flex;align-items:center;justify-content:space-between;
  padding-top:26px;border-top:1px solid ${t.line};font-size:23px;font-weight:700;color:${t.mute}}
.foot b{color:${t.ink}}
</style></head>
<body><div class="poster">
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="watermark">LAHN</div>
  <div class="disc">${bigDisc(t)}</div>
  <div class="brand">${logoMark(58)}<span class="word"><b>Lahn</b><span dir="rtl">لحن</span></span></div>
  <p class="tag">One app, <b>your whole library</b> — on the PC and on the phone, over your own Wi-Fi</p>
  <div class="row">${ids.map((id) => phone(shots[id], t)).join('')}</div>
  <div class="labels"><span>Home</span><span>Songs</span><span>Turntable</span><span>Search</span></div>
  <div class="foot"><span><b>${hero.count} songs</b> · offline on PC and phone · nothing in the cloud</span><span>made with Lahn · <bdi dir="rtl">لحن</bdi></span></div>
  <svg class="grain"><filter id="gr"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="4"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#gr)"/></svg>
</div></body></html>`;
}

const POSTERS = [
  { name: 'lahn-promo-story-dark.png', kind: story, theme: 'dark' },
  { name: 'lahn-promo-story-light.png', kind: story, theme: 'light' },
  { name: 'lahn-promo-showcase-dark.png', kind: showcase, theme: 'dark' },
  { name: 'lahn-promo-showcase-light.png', kind: showcase, theme: 'light' },
];

/* ---------------------------------------------------------------- render */

async function main() {
  mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });

  const shots = {};
  let now = null;
  for (const theme of ['dark', 'light']) {
    const captured = await capture(browser, theme);
    shots[theme] = captured.files;
    now ??= captured.playing;
  }
  const hero = heroTrack(now?.id);
  if (hero) hero.elapsed = now?.elapsed;

  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const poster of POSTERS) {
    const file = path.join(TMP, poster.name.replace('.png', '.html'));
    writeFileSync(file, poster.kind(poster, shots[poster.theme], hero));
    await page.setViewportSize({ width: 1080, height: poster.name.includes('story') ? 1920 : 1080 });
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const off = await page.evaluate(() => {
      const box = document.querySelector('.poster').getBoundingClientRect();
      return [...document.querySelectorAll('.brand,.nav,h1,.lede,.card,.phone,.foot,.tag,.row,.labels')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > box.bottom + 2 || r.top < box.top - 2 || r.right > box.right + 2 || r.left < box.left - 2;
        })
        .map((el) => el.className.split(' ')[0]);
    });
    await page.locator('.poster').screenshot({ path: path.join(OUT, poster.name) });
    console.log(`${poster.name}  ${off.length ? `⚠ outside frame: ${off.join(', ')}` : '✓'}`);
  }

  await browser.close();
  rmSync(TMP, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
