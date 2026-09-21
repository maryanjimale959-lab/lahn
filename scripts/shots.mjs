import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.LAHN_URL ?? 'http://localhost:5173';
const OUT = path.resolve('shots');
mkdirSync(OUT, { recursive: true });

const problems = [];

function report(err) {
  console.log('\n================ problems ================');
  if (err) console.log('aborted:', String(err.message).split('\n')[0]);
  [...new Set(problems)].forEach((p) => console.log(p));
  if (!err && !problems.length) console.log('none');
}

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
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale });
  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`[${name}] console: ${msg.text().slice(0, 300)}`);
  });
  page.on('pageerror', (err) => problems.push(`[${name}] pageerror: ${err.message.slice(0, 300)}`));
  page.on('requestfailed', (req) => problems.push(`[${name}] requestfailed: ${req.url().slice(0, 160)} ${req.failure()?.errorText}`));
  return { ctx, page };
}

const shot = async (page, name, full = false) => {
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

  await page.click('.topbar .pill-btn');
  await settle(page, 700);
  await shot(page, '11-mobile-add');
  await page.keyboard.press('Escape');
  await settle(page, 400);

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

/* ---------- arabic / RTL ---------- */
{
  const { page, ctx } = await pageFor('rtl', { width: 390, height: 844 }, 'ar');
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('lahn.lang', 'ar'));
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  await shot(page, '20-rtl-home');

  await page.click('.tabbar a[href="#/songs"]');
  await settle(page);
  await page.click('.track');
  await settle(page, 1600);
  await page.click('.mini');
  await settle(page, 1400);
  await shot(page, '21-rtl-vinyl');

  await page.keyboard.press('Escape');
  await settle(page, 500);
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
  await settleHealth(page);
  await settle(page, 400);
  await shot(page, '22-rtl-settings', true);

  await page.evaluate(() => localStorage.setItem('lahn.lang', 'en'));
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
