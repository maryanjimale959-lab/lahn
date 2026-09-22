import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.LAHN_URL ?? 'http://localhost:5173';
/* These shots fill a form whose submit route is mocked, so the account is never touched. */
const DEV_PASSWORD = 'shot-password';
const OUT = path.resolve('shots');
mkdirSync(OUT, { recursive: true });

const problems = [];

function report(err) {
  console.log('\n================ problems ================');
  if (err) console.log('aborted:', String(err.message).split('\n')[0]);
  [...new Set(problems)].forEach((p) => console.log(p));
  if (!err && !problems.length) console.log('none');
}

/* Windows suspends the Wi-Fi adapter mid-run now and then; the long-lived session
   stream is the first thing to show it, and it says nothing about Laxan. */
const transient = /ERR_NETWORK_IO_SUSPENDED|ERR_INTERNET_DISCONNECTED/i;
const note = (text) => {
  if (!transient.test(text)) problems.push(text);
};

process.on('uncaughtException', (err) => {
  report(err);
  process.exit(1);
});

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--font-render-hinting=none'],
});

async function pageFor(name, viewport, locale = 'en-US') {
  /* Each context is a different device, so a screen that is still mirroring the last
     one to play would cover the mini player these shots are about. */
  await fetch(`${BASE}/api/session`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device: { id: 'shots-reset', name: 'Shots', kind: 'desktop' }, session: { trackId: null, queueIds: [] } }),
  }).catch(() => {});
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale });
  /* Chromium probes /favicon.ico even with an SVG icon declared; the 404 it logs
     would otherwise sit in the report as a permanent false alarm. */
  await ctx.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }));
  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') note(`[${name}] console: ${msg.text().slice(0, 300)}`);
  });
  page.on('pageerror', (err) => problems.push(`[${name}] pageerror: ${err.message.slice(0, 300)}`));
  page.on('response', (res) => {
    if (res.status() >= 400) problems.push(`[${name}] http ${res.status()}: ${res.url().slice(0, 160)}`);
  });
  page.on('requestfailed', (req) => note(`[${name}] requestfailed: ${req.url().slice(0, 160)} ${req.failure()?.errorText}`));
  return { ctx, page };
}

/* Card art is lazy-loaded, and a fullPage capture never scrolls, so walk every
   scroll container first and wait for the images to actually arrive. */
const loadArt = async (page) => {
  await page.evaluate(async () => {
    const hosts = [
      document.scrollingElement ?? document.documentElement,
      ...[...document.querySelectorAll('*')].filter(
        (el) => el.scrollHeight > el.clientHeight + 40 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)
      ),
    ];
    for (const el of new Set(hosts)) {
      const top = el.scrollTop;
      for (let y = 0; y <= el.scrollHeight; y += Math.max(200, el.clientHeight * 0.7)) {
        el.scrollTop = y;
        await new Promise((r) => setTimeout(r, 90));
      }
      el.scrollTop = top;
    }
    await Promise.all(
      [...document.images].map((img) => (img.complete ? null : new Promise((r) => ((img.onload = img.onerror = r), setTimeout(r, 3000)))))
    );
  });
};

const shot = async (page, name, full = false) => {
  await loadArt(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log('shot', name);
};

const settle = async (page, ms = 900) => page.waitForTimeout(ms);

/* Settings renders "—" until /api/health resolves, so screenshots wait for the
   phone chip to come back as host:port rather than using a fixed delay. */
const settleHealth = async (page) =>
  page
    .waitForFunction(() => /:\d{2,}$/.test((document.querySelector('.lan-list a')?.textContent ?? '').trim()), null, { timeout: 6000 })
    .catch(() => {});

/* ---------- desktop ---------- */
{
  const { page, ctx } = await pageFor('desktop', { width: 1320, height: 900 });
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' });
  await settle(page);
  await shot(page, '01-desktop-home');

  await page.click('.nav a[href="#/songs"]');
  await settle(page);
  await shot(page, '02-desktop-songs');

  await page.click('.nav a[href="#/talks"]');
  await settle(page, 1200);
  await shot(page, '23-desktop-talks');

  await page.click('.nav a[href="#/channels"]');
  await settle(page);
  await shot(page, '24-desktop-channels');

  await page.goto(`${BASE}/#/shelf/podcasts`, { waitUntil: 'networkidle' });
  await settle(page, 1200);
  await shot(page, '25-desktop-shelf');

  await page.click('.nav a[href="#/artists"]');
  await settle(page);
  await shot(page, '03-desktop-artists');

  await page.click('.grid .tile');
  await settle(page);
  await shot(page, '04-desktop-artist-page');

  await page.click('.detail-cta .pill-btn');
  await settle(page, 1800);
  await shot(page, '05-desktop-mini');

  await page.click('.mini');
  await settle(page, 1600);
  await shot(page, '06-desktop-vinyl');

  /* The audio element is detached (new Audio()), so playback is proven through the
     elapsed label rather than a DOM query. */
  const elapsed = async () => {
    const [m, s] = ((await page.textContent('.now .times span')) ?? '0:00').split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
  };
  const atStart = await elapsed();
  await settle(page, 3000);
  const after = await elapsed();
  if (!(after > atStart)) problems.push(`[desktop] playback stalled at ${atStart}s (then ${after}s)`);
  else console.log('playing', `${atStart}s -> ${after}s`);

  await page.click('.now .t-btn[aria-label="Up next"], .now .icon-btn:last-child');
  await settle(page, 600);
  await shot(page, '07-desktop-queue');

  await page.keyboard.press('Escape');
  await settle(page, 400);

  await page.click('.topbar .icon-btn');
  await settle(page, 900);
  await page.click('.nav a[href="#/home"]');
  await settle(page, 700);
  await shot(page, '08-desktop-dark');

  await ctx.close();
}

/* ---------- playlists ---------- */
{
  const { page, ctx } = await pageFor('playlists', { width: 1320, height: 900 });
  await page.goto(`${BASE}/#/playlists`, { waitUntil: 'networkidle' });
  await settle(page);
  await shot(page, '15-desktop-playlists');

  if (await page.locator('.grid .tile').count()) {
    await page.click('.grid .tile');
    await settle(page);
    await shot(page, '16-desktop-playlist-page');
  }

  await page.goto(`${BASE}/#/songs`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.hover('.track');
  await page.click('.row-add');
  await settle(page, 500);
  await shot(page, '17-desktop-add-menu');

  await ctx.close();
}

/* ---------- settings ---------- */
{
  const { page, ctx } = await pageFor('settings', { width: 1320, height: 900 });
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
  await settleHealth(page);
  await settle(page, 400);
  await shot(page, '18-desktop-settings', true);

  await page.evaluate(() => localStorage.setItem('lahn.theme', 'dark'));
  await page.reload({ waitUntil: 'networkidle' });
  await settleHealth(page);
  await settle(page, 400);
  await shot(page, '19-desktop-settings-dark', true);
  await page.evaluate(() => localStorage.setItem('lahn.theme', 'light'));

  await ctx.close();
}

/* ---------- mobile ---------- */
{
  const { page, ctx } = await pageFor('mobile', { width: 390, height: 844 });
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' });
  await settle(page);
  await shot(page, '10-mobile-home');

  await page.goto(`${BASE}/#/shelf/music`, { waitUntil: 'networkidle' });
  await settle(page, 1200);
  /* A fullPage capture paints the fixed top bar and tab bar in the middle of the
     image, so the phone shots stay one screen tall — what she actually sees. */
  await shot(page, '11-mobile-shelf');

  await page.click('.tabbar a[href="#/songs"]');
  await settle(page);
  await page.click('.track');
  await settle(page, 1800);
  await shot(page, '12-mobile-mini');

  await page.click('.mini');
  await settle(page, 1600);
  await shot(page, '13-mobile-vinyl');

  await page.click('.now .icon-btn');
  await settle(page, 500);
  await page.click('.tabbar a[href="#/search"]');
  await settle(page, 600);
  await shot(page, '14-mobile-search');

  await ctx.close();
}

/* ---------- somali ---------- */
{
  const { page, ctx } = await pageFor('somali', { width: 390, height: 844 }, 'so');
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('lahn.lang', 'so'));
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  await shot(page, '20-somali-home');

  await page.click('.tabbar a[href="#/songs"]');
  await settle(page);
  await page.click('.track');
  await settle(page, 1600);
  await page.click('.mini');
  await settle(page, 1400);
  await shot(page, '21-somali-vinyl');

  await page.keyboard.press('Escape');
  await settle(page, 500);
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
  await settleHealth(page);
  await settle(page, 400);
  await shot(page, '22-somali-settings', true);

  await page.evaluate(() => localStorage.setItem('lahn.lang', 'en'));
  await ctx.close();
}

/* ---------- the door ---------- */
{
  const { page, ctx } = await pageFor('door', { width: 1320, height: 900 });
  /* Her real library is open to whoever reaches it until an account exists, and shooting
     a signup for real would lock her out. So the door is posed with a fake /api/me. */
  const listener = { id: 'shot', email: 'maryam@lahn.local', name: 'Maryam', interests: [], created_at: '2026-09-22' };
  await page.route('**/api/me', async (route) => {
    const signed = route.request().method() !== 'GET';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: signed ? listener : null, accounts: 1 }),
    });
  });
  await page.route('**/api/signup', (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ user: listener }) })
  );

  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' });
  await settle(page);
  await shot(page, '40-door-signin');

  await page.click('.welcome-tabs button:nth-child(2)');
  await settle(page, 300);
  await page.fill('.welcome-card input[type="email"]', 'maryam@lahn.local');
  await page.fill('.welcome-card input[type="password"]', DEV_PASSWORD);
  await shot(page, '41-door-signup');

  await page.evaluate(() => localStorage.setItem('lahn.lang', 'so'));
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  await page.click('.welcome-tabs button:nth-child(2)');
  await settle(page, 300);
  await shot(page, '42-door-signup-so');
  await page.evaluate(() => localStorage.setItem('lahn.lang', 'en'));

  /* The interest picker only appears after a real account, so step in through the
     same state the app uses rather than signing up on her machine. */
  await page.fill('.welcome-card input[type="email"]', 'maryam@lahn.local');
  await page.fill('.welcome-card input[type="password"]', DEV_PASSWORD);
  await page.click('.welcome-card button[type="submit"]');
  await page.waitForSelector('.pick-grid', { timeout: 6000 });
  await settle(page, 800);
  await shot(page, '43-door-interests');
  await page.click('.pick-tile:nth-child(1)');
  await page.click('.pick-tile:nth-child(4)');
  await page.click('.pick-tile:nth-child(8)');
  await settle(page, 300);
  await shot(page, '44-door-interests-picked');

  await ctx.close();
}

/* ---------- mobile door ---------- */
{
  const { page, ctx } = await pageFor('door-phone', { width: 390, height: 844 });
  await page.route('**/api/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: null, accounts: 1 }) })
  );
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' });
  await settle(page);
  await shot(page, '45-door-phone');
  await ctx.close();
}

/* ---------- empty state ---------- */
{
  const { page, ctx } = await pageFor('empty', { width: 1320, height: 900 });
  await page.route('**/api/library', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ stats: { tracks: 0, artists: 0, albums: 0, playlists: 0, seconds: 0, bytes: 0 }, recent: [], popular: [], artists: [], albums: [], playlists: [], tracks: [] }),
    });
  });
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' });
  await settle(page);
  await shot(page, '30-empty-onboarding');
  await ctx.close();
}

await browser.close();

report();
