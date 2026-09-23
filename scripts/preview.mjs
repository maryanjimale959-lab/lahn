/* What does Laxan actually look like tonight? Sign a preview listener in, then photograph the
   shelves she would land on — desktop and phone, Somali and English. */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.LAHN_URL ?? 'http://localhost:4780';
const EMAIL = 'preview@lahn.test';
const PASSWORD = 'preview123';
const OUT = path.resolve('shots', 'preview');
mkdirSync(OUT, { recursive: true });

const res = await fetch(`${BASE}/api/signup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: EMAIL,
    name: 'Maryam',
    password: PASSWORD,
    interests: ['music', 'rap', 'love', 'podcasts', 'quran', 'stories', 'lessons', 'books', 'amusic', 'apodcast'],
    terms: true,
  }),
});
let token = (res.headers.get('set-cookie') ?? '').match(/lahn_token=([^;]+)/)?.[1];
if (!token) {
  const login = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  token = (login.headers.get('set-cookie') ?? '').match(/lahn_token=([^;]+)/)?.[1];
}
if (!token) {
  console.log('preview account would not open:', res.status);
  process.exit(1);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--font-render-hinting=none'] });
const host = new URL(BASE).host;

async function open({ width, height, lang }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: lang });
  await ctx.addCookies([{ name: 'lahn_token', value: token, domain: host.startsWith('localhost') ? 'localhost' : host, path: '/', httpOnly: true, sameSite: 'Lax' }]);
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text().slice(0, 120)}`));
  page.on('pageerror', (e) => problems.push(`pageerror: ${String(e.message).slice(0, 120)}`));
  page.on('requestfailed', (r) => !/favicon/i.test(r.url()) && problems.push(`requestfailed: ${r.url().slice(0, 90)}`));
  return { ctx, page, problems };
}

/* Her library is live data, so a photograph must never leave a mark. */
async function muteSideEffects(page) {
  await page.route('**/api/tracks/**/play', (route) => route.fulfill({ status: 204, body: '' }));
}

const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log('shot', `${name}.png`);
};

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const all = [];

/* Home and the shelves, in Somali, on the desktop. */
{
  const { ctx, page, problems } = await open({ ...DESKTOP, lang: 'en-US' });
  await page.addInitScript(() => localStorage.setItem('lahn.lang', 'so'));
  for (const [route, name] of [
    ['#/home', '01-home-so'],
    ['#/shelf/quran', '02-quran-so'],
    ['#/shelf/podcasts', '03-podcasts-so'],
    ['#/artists', '04-artists-so'],
    ['#/shelf/amusic', '05-arabic-music-so'],
  ]) {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await shot(page, name);
  }
  /* Search: the thing she said was broken. */
  await page.goto(`${BASE}/#/search`, { waitUntil: 'networkidle' });
  await page.fill('input[type="search"], .search-input input, input[placeholder]', 'Hodan');
  await page.waitForTimeout(4000);
  await shot(page, '06-search-so');
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, '07-settings-so');
  all.push(...problems);
  await ctx.close();
}

/* The turntable, which is the screen she opens the app for. */
{
  const { ctx, page, problems } = await open({ ...DESKTOP, lang: 'en-US' });
  await page.addInitScript(() => localStorage.setItem('lahn.lang', 'so'));
  await muteSideEffects(page);
  await page.goto(`${BASE}/#/shelf/music`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.cat:not(.sk) .cat-art', { timeout: 30000 });
  await page.click('.cat:not(.sk) .cat-art');
  await page.waitForSelector('.mini', { timeout: 15000 });
  /* The deck itself only opens through its own route, the same way a tap on the bar does. */
  await page.evaluate(() => {
    location.hash = '#/now';
  });
  await page.waitForSelector('section.now', { timeout: 15000 });
  await page
    .waitForFunction(() => !document.querySelector('.now-note'), null, { timeout: 150000 })
    .catch(() => console.log('turntable still preparing when the shutter fell'));
  await page.waitForTimeout(2500);
  await shot(page, '11-playing-so');
  all.push(...problems);
  await ctx.close();
}

/* The same app in English on a phone, which is what she carries. */
{
  const { ctx, page, problems } = await open({ ...PHONE, lang: 'en-US' });
  await page.addInitScript(() => localStorage.setItem('lahn.lang', 'en'));
  for (const [route, name] of [
    ['#/home', '08-home-phone-en'],
    ['#/shelf/stories', '09-stories-phone-en'],
    ['#/artists', '10-artists-phone-en'],
  ]) {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await shot(page, name);
  }
  all.push(...problems);
  await ctx.close();
}

await browser.close();
const del = await fetch(`${BASE}/api/me`, { method: 'DELETE', headers: { cookie: `lahn_token=${token}` } });
console.log('preview account removed:', del.status);
console.log('\nproblems:');
console.log(all.length ? [...new Set(all)].join('\n') : 'none');
