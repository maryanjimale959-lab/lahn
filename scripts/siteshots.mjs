/* Look at the landing page the way a visitor will: served from a static folder, in all three
   languages, on a desktop and a phone. It writes photographs into `.tmp-site/` (never committed) and
   reports what broke — a dead image, a language switch that left Somali words behind, a button that
   did nothing. */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'site', 'dist');
const OUT = path.join(ROOT, '.tmp-site');
const PORT = 4799;
const BASE = `http://127.0.0.1:${PORT}`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.log('nothing to look at — run: npm run site');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const problems = [];
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, BASE).pathname);
  /* A folder has to answer with its index.html — the preview lives at /app/, and a visitor types
     exactly that, without a file name. */
  const wanted = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const file = path.join(DIST, wanted.replace(/^\/+/, ''));
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((d) => server.listen(PORT, '127.0.0.1', d));

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--font-render-hinting=none'] });

const openPage = async ({ width, height, lang }) => {
  const locale = { so: 'so-SO', ar: 'ar-EG', en: 'en-US' }[lang];
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale });
  const page = await ctx.newPage();
  await ctx.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/i.test(m.text()) && problems.push(`[${lang}] console: ${m.text().slice(0, 150)}`));
  page.on('pageerror', (e) => problems.push(`[${lang}] pageerror: ${String(e.message).slice(0, 150)}`));
  page.on('response', (r) => r.status() >= 400 && !/favicon/.test(r.url()) && problems.push(`[${lang}] http ${r.status()}: ${r.url().slice(0, 120)}`));
  await page.addInitScript((l) => localStorage.setItem('laxan.site.lang', l), lang);
  return { ctx, page };
};

/* Scroll the whole page first: reveals are switched on by intersection, so a single shutter at the
   top of a long page would photograph a row of invisible sections. */
const walk = async (page) => {
  await page.evaluate(async () => {
    /* A visitor scrolls slowly and lazy images arrive in time. A camera does not, so the photographs
       ask for every image up front — the page itself keeps loading="lazy". */
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
    const h = document.scrollingElement.scrollHeight;
    for (let y = 0; y <= h; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  });
  await page
    .waitForFunction(() => [...document.images].every((i) => i.complete && (i.naturalWidth > 0 || !i.currentSrc)), null, { timeout: 20000 })
    .catch(async () => {
      const stuck = await page.evaluate(() => [...document.images].filter((i) => !(i.complete && (i.naturalWidth > 0 || !i.currentSrc))).map((i) => `${i.currentSrc || i.src} (complete:${i.complete})`));
      problems.push(`an image never arrived: ${stuck.join(', ')}`);
    });
  await page.waitForTimeout(900);
};

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

for (const lang of ['so', 'ar', 'en']) {
  const { ctx, page } = await openPage({ ...DESKTOP, lang });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await walk(page);
  const h1 = (await page.textContent('h1'))?.replace(/\s+/g, ' ').trim();
  console.log(`${lang}: h1 = "${h1}"`);
  if (!h1 || h1.length < 8) problems.push(`[${lang}] the headline is empty`);
  const dir = await page.evaluate(() => document.documentElement.dir);
  if (lang === 'ar' && dir !== 'rtl') problems.push(`[${lang}] Arabic is not laying out right-to-left`);
  if (lang !== 'ar' && dir !== 'ltr') problems.push(`[${lang}] ${dir} direction`);
  /* A translated page must not still carry the Somali it was written in. */
  const leftover = await page.evaluate(
    (l) =>
      l === 'so'
        ? ''
        : [...document.querySelectorAll('[data-i18n]')]
            .filter((n) => /wax walba|dhageyso|Astaamaha|Su'aalaha|Ku rakib telefoonka|akoon/i.test(n.textContent))
            .map((n) => n.dataset.i18n)
            .join(' '),
    lang
  );
  if (leftover) problems.push(`[${lang}] still Somali: ${leftover}`);

  const cards = await page.$$eval('.card', (n) => n.length);
  const photos = await page.$$eval('img', (n) => n.length);
  const names = await page.$$eval('.marquee span', (n) => n.length);
  const faqs = await page.$$eval('.qa details', (n) => n.length);
  if (cards !== 6) problems.push(`[${lang}] ${cards} feature cards`);
  /* The welcome page carries no photographs of the app: type, colour and motion do the talking. */
  if (photos) problems.push(`[${lang}] ${photos} images — the page is meant to be image-free`);
  if (names < 20) problems.push(`[${lang}] only ${names} source names in the marquee`);
  if (faqs !== 6) problems.push(`[${lang}] ${faqs} FAQ entries`);

  const stats = await page.$$eval('.stats b', (ns) => ns.map((n) => n.textContent));
  /* Arabic renders its own numerals, so "no digits left" has to look for those too. */
  const DIGIT = /[\u0660-\u0669\u06f0-\u06f90-9]/;
  if (stats.some((s) => !DIGIT.test(s) || s.replace(/[^0-9\u0660-\u0669\u06f0-\u06f9]/g, '') === '0')) {
    problems.push(`[${lang}] counters stopped at ${stats.join(',')}`);
  }
  else console.log(`${lang}: counters ${stats.join(' · ')}`);

  /* The hero first, at the top of the page — the FAQ test below scrolls away from it. */
  await page.screenshot({ path: path.join(OUT, `landing-${lang}-hero.png`) });

  await page.click('.qa details:nth-child(3) summary');
  if (!(await page.evaluate(() => document.querySelectorAll('.qa details')[2].open))) problems.push(`[${lang}] FAQ would not open`);

  await page.screenshot({ path: path.join(OUT, `landing-${lang}-full.png`), fullPage: true });
  console.log(`  📷 landing-${lang}-hero.png / -full.png`);
  await ctx.close();
}

/* The phone, in Somali, plus the two things a visitor actually presses. */
{
  const { ctx, page } = await openPage({ ...PHONE, lang: 'so' });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await walk(page);
  await page.screenshot({ path: path.join(OUT, 'landing-so-phone.png'), fullPage: true });
  console.log('  📷 landing-so-phone.png');

  await page.evaluate(() => document.getElementById('install').scrollIntoView());
  await page.waitForTimeout(600);
  await page.click('[data-install="android"]');
  await page.waitForTimeout(500);
  const toastVisible = await page.evaluate(() => !document.getElementById('toast').hidden);
  if (!toastVisible) problems.push('the Android install button did nothing at all');
  else console.log('  ✓ the install button answers:', await page.textContent('#toast'));

  await page.click('[data-install="ios"]');
  await page.waitForTimeout(400);
  const sheet = await page.evaluate(() => !document.getElementById('ios-sheet').hidden);
  if (!sheet) problems.push('the iPhone instructions did not open');
  await page.screenshot({ path: path.join(OUT, 'landing-so-phone-sheet.png') });
  await page.keyboard.press('Escape');
  if (await page.evaluate(() => !document.getElementById('ios-sheet').hidden)) problems.push('Escape left the sheet open');

  /* The nav has to land on the app, and the app has to be the built preview. */
  await page.click('.langs button[data-lang="en"]');
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => document.documentElement.lang === 'en'))) problems.push('the language switch did not take');
  await ctx.close();
}

{
  const { ctx, page } = await openPage({ ...DESKTOP, lang: 'so' });
  await page.goto(`${BASE}/app/#/home`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.cat:not(.sk)', { timeout: 30000 });
  const n = await page.$$eval('.cat:not(.sk)', (x) => x.length);
  if (n < 24) problems.push(`the app behind the landing page shows ${n} cards`);
  else console.log(`  ✓ the linked app opens on ${n} cards of real shelves`);
  await page.screenshot({ path: path.join(OUT, 'app-linked.png') });
  await ctx.close();
}

await browser.close();
server.close();
console.log(problems.length ? `\n${problems.length} problem(s):` : '\n0 problems — the landing page is ready');
for (const p of [...new Set(problems)]) console.log(`  ✗ ${p}`);
process.exit(problems.length ? 1 : 0);
