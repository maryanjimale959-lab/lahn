#!/usr/bin/env node
/**
 * Renders shareable poster images of the library for social media.
 *
 *   node scripts/poster.mjs
 *   POSTER_TITLE="Late Shift" node scripts/poster.mjs
 *
 * Titles are cleaned for display only — the database is never touched.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { tidyTitle } from '../server/src/ytdlp.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'share');
const TMP = path.join(OUT, '.render');
const DB = path.join(ROOT, 'server', 'data', 'lahn.db');
const LIB = path.join(ROOT, 'library');

const TITLE = process.env.POSTER_TITLE || 'My Playlist';
const BYLINE = process.env.POSTER_BY || 'curated by Maryam J.';

/* story: deck above one column · square: deck above two · wide: deck beside two.
   `s` scales every size so the three formats stay proportional. */
const FORMATS = [
  { id: 'story', w: 1080, h: 1920, theme: 'dark', cols: 1, side: false, deck: 440, thumb: 72, s: 1 },
  { id: 'story', w: 1080, h: 1920, theme: 'light', cols: 1, side: false, deck: 440, thumb: 72, s: 1 },
  { id: 'square', w: 1080, h: 1080, theme: 'dark', cols: 2, side: false, deck: 330, thumb: 56, s: 0.74 },
  { id: 'square', w: 1080, h: 1080, theme: 'light', cols: 2, side: false, deck: 330, thumb: 56, s: 0.74 },
  { id: 'wide', w: 1600, h: 900, theme: 'dark', cols: 2, side: true, deck: 330, thumb: 58, s: 0.8 },
];

/* ---------------------------------------------------------------- data */

function readLibrary() {
  const db = new DatabaseSync(DB, { readOnly: true });
  const rows = db
    .prepare(
      `SELECT t.title, t.duration, t.cover, a.name AS artist
         FROM tracks t LEFT JOIN artists a ON a.id = t.artist_id
        ORDER BY t.added_at`
    )
    .all();
  db.close();
  return rows.map(display).filter((t) => t.title);
}

const VERSION_TAG = /^(live|acoustic|instrumental|remix|edit|demo|version|take|from|official)\b/i;

/** Turns a stored row into something worth printing: no upload noise, one artist, no shouting. */
function display(row) {
  const credited = String(row.artist ?? '').trim();
  const raw = String(row.title ?? '');
  let artist = credited.split(/[|,(]/)[0].trim();
  let title = tidyTitle(raw, artist);

  /* When the credit is really the upload channel — "Invited Kingdom" for a NAPA track — the
     artist lives in the title's "Artist - Track" prefix instead. Skip it when tidyTitle already
     removed that prefix, which is how you can tell the credit was genuine. */
  const split = title.match(/^([^-\u2013\u2014|]{2,40}?)\s*[-\u2013\u2014|]\s+(.+)$/);
  const creditedInTitle = credited && raw.toLowerCase().includes(credited.toLowerCase());
  if (split && !creditedInTitle && !VERSION_TAG.test(split[1])) {
    artist = split[1].trim();
    title = split[2].trim();
  }

  return {
    title: quiet(junkFree(title.trim())),
    artist: artist || 'Unknown artist',
    duration: Number(row.duration) || 0,
    cover: coverData(row.cover),
  };
}

/* tidyTitle keeps bracketed noise it recognises, but "…Feat X Kol Ikaalay New Official Music
   Video 2025" arrives bare at the end of the title. The trailing year only goes with it —
   "Woodstock 1969" is a title, not a stamp. */
function junkFree(text) {
  const stripped = text.replace(/\s*\b(?:new\s+)?official\s+(?:music\s+|lyric\s+|audio\s+)?(?:video|visualizer|stream)\b.*$/i, '');
  if (stripped === text) return text.trim();
  return stripped.replace(/\s+(?:19|20)\d{2}\s*$/, '').replace(/[\s[-–—|,]+$/, '').trim() || text.trim();
}

/** Uploads shout in ALL CAPS; re-case only the rows that are entirely uppercase. */
function quiet(text) {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (letters.length < 4 || letters !== letters.toUpperCase()) return text;
  const small = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'on', 'to', 'new', 'la', 'le', 'les', 'de', 'du', 'el']);
  const cased = text
    .toLocaleLowerCase()
    .replace(/(^\p{L})|(\s\p{L})|([-/'’]\p{L})/gu, (m) => m.toUpperCase());
  return cased
    .replace(/\p{L}+/gu, (w) => (small.has(w.toLowerCase()) ? w.toLowerCase() : w))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function coverData(rel) {
  if (!rel) return null;
  const abs = path.join(LIB, rel);
  return existsSync(abs) ? `data:image/jpeg;base64,${readFileSync(abs).toString('base64')}` : null;
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* --------------------------------------------------------------- markup */

const FONTS = [
  ['Manrope', 'manrope', 'manrope-latin'],
  ['Manrope', 'manrope', 'manrope-latin-ext'],
  ['Manrope', 'manrope', 'manrope-vietnamese'],
]
  .map(([family, pkg, subset]) => {
    const file = path.join(ROOT, 'node_modules', '@fontsource-variable', pkg, 'files', `${subset}-wght-normal.woff2`);
    return `@font-face{font-family:'${family}';font-weight:100 900;font-style:normal;src:url('${pathToFileURL(file)}') format('woff2-variations');}`;
  })
  .join('\n');

const THEMES = {
  light: { bg: '#f2f1ee', ink: '#141317', mute: '#7a7781', line: 'rgba(20,19,23,.12)', glowA: 'rgba(255,157,92,.45)', glowB: 'rgba(96,196,190,.36)', shadow: 'rgba(20,19,23,.13)' },
  dark: { bg: '#0d0c10', ink: '#f4f2ef', mute: '#9b97a3', line: 'rgba(244,242,239,.13)', glowA: 'rgba(224,82,63,.42)', glowB: 'rgba(74,157,163,.30)', shadow: 'rgba(0,0,0,.34)' },
};

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

/** The record: grooves, the top cover as the centre label, and the tonearm resting on it. */
function turntable(track, shadow) {
  const c = 260;
  const label = 96;
  const grooves = [232, 214, 196, 178, 160, 142, 126]
    .map((g) => `<circle cx="${c}" cy="${c}" r="${g}" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="1.4"/>`)
    .join('');
  return `<svg class="deck" viewBox="0 0 520 520" aria-hidden="true">
    <defs>
      <radialGradient id="vinyl" cx="36%" cy="26%" r="86%"><stop offset="0" stop-color="#403c47"/><stop offset=".5" stop-color="#17151b"/><stop offset="1" stop-color="#07070a"/></radialGradient>
      <clipPath id="label"><circle cx="${c}" cy="${c}" r="${label}"/></clipPath>
    </defs>
    <ellipse cx="${c + 8}" cy="${c + 22}" rx="250" ry="250" fill="${shadow}"/>
    <circle cx="${c}" cy="${c}" r="250" fill="url(#vinyl)"/>
    ${grooves}
    ${
      track.cover
        ? `<image href="${track.cover}" x="${c - label}" y="${c - label}" width="${label * 2}" height="${label * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#label)"/>`
        : `<circle cx="${c}" cy="${c}" r="${label}" fill="#e0523f"/>`
    }
    <circle cx="${c}" cy="${c}" r="${label}" fill="none" stroke="#0a0a0c" stroke-opacity=".45" stroke-width="3"/>
    <circle cx="${c}" cy="${c}" r="7" fill="#f4f2ef"/>
    <g transform="rotate(31 440 80)">
      <rect x="434" y="78" width="12" height="150" rx="6" fill="#c9c4bd"/>
      <rect x="427" y="218" width="26" height="36" rx="9" fill="#8e8983"/>
      <rect x="433" y="250" width="14" height="10" rx="4" fill="#5f5c63"/>
      <rect x="430" y="42" width="20" height="38" rx="9" fill="#8e8983"/>
      <circle cx="440" cy="80" r="27" fill="#d8d3cc"/><circle cx="440" cy="80" r="11" fill="#8e8983"/>
    </g>
  </svg>`;
}

const row = (track, i, wrapAt) => `<li class="${track.title.length > wrapAt ? 'long' : ''}">
    <span class="n">${i + 1}</span>
    ${track.cover ? `<img class="thumb" src="${track.cover}" alt=""/>` : '<span class="thumb blank"></span>'}
    <span class="meta"><b>${esc(track.title)}</b><i>${esc(track.artist)}</i></span>
    <span class="d">${mmss(track.duration)}</span>
  </li>`;

function html(f, tracks) {
  const { w, h, theme, cols, side, deck, thumb, s } = f;
  const t = THEMES[theme];
  const px = (v) => `${Math.round(v * s)}px`;
  const total = Math.round(tracks.reduce((sum, x) => sum + x.duration, 0) / 60);
  const hero = tracks[0];

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{font-family:'Manrope',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.poster{position:relative;width:${w}px;height:${h}px;background:${t.bg};color:${t.ink};
  --fit:1;--dfit:1;
  display:flex;flex-direction:column;overflow:hidden;font-size:${px(27)};padding:${px(60)} ${px(62)} ${px(48)}}
.poster::before,.poster::after{content:'';position:absolute;border-radius:50%;filter:blur(${px(92)});pointer-events:none}
.poster::before{width:${Math.round(w * 0.78)}px;height:${Math.round(w * 0.78)}px;top:-${Math.round(w * 0.3)}px;left:-${Math.round(w * 0.24)}px;background:${t.glowA}}
.poster::after{width:${Math.round(w * 0.62)}px;height:${Math.round(w * 0.62)}px;bottom:-${Math.round(w * 0.22)}px;right:-${Math.round(w * 0.2)}px;background:${t.glowB}}
.poster>*{position:relative;z-index:1}

header{display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:${px(16)}}
.mark{border-radius:${px(15)};box-shadow:0 ${px(8)} ${px(22)} rgba(0,0,0,.20)}
.word{display:flex;align-items:baseline;gap:${px(10)}}
.word b{font-size:${px(42)};font-weight:800;letter-spacing:-.045em}
.word span{font-size:${px(24)};font-weight:600;color:${t.mute}}
.stats{font-size:${px(21)};font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:${t.mute}}

.head{display:flex;align-items:flex-end;justify-content:space-between;gap:${px(24)};margin-top:${px(42)}}
h1{font-size:${px(92)};font-weight:800;line-height:.98;letter-spacing:-.045em}
.by{margin-top:${px(12)};font-size:${px(27)};font-weight:600;color:${t.mute}}
.now{text-align:right;max-width:42%;font-size:${px(20)};line-height:1.4;color:${t.mute}}
.now b{display:block;color:${t.ink};font-size:${px(25)};font-weight:700;margin-top:${px(4)}}

.body{flex:1;min-height:0;display:flex;${side ? `flex-direction:row;gap:${px(50)};align-items:center` : `flex-direction:column;gap:${px(14)};justify-content:center`}}
.stage{flex:none;display:grid;place-items:center;min-height:0}
.deck{width:calc(${deck}px * var(--dfit));height:calc(${deck}px * var(--dfit))}
.tracks{flex:1;min-width:0;list-style:none;display:grid;align-content:center;gap:calc(${px(9)} * var(--fit));${cols === 2 ? `grid-template-columns:1fr 1fr;column-gap:${px(32)}` : ''}}
li{display:flex;align-items:center;gap:calc(${px(17)} * var(--fit));min-width:0}
li.more{justify-content:center;font-size:calc(${px(22)} * var(--fit));font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${t.mute}}
.n{width:2.5ch;font-size:calc(${px(20)} * var(--fit));font-weight:700;color:${t.mute};font-variant-numeric:tabular-nums}
.thumb{width:calc(${px(thumb)} * var(--fit));height:calc(${px(thumb)} * var(--fit));border-radius:calc(${px(14)} * var(--fit));object-fit:cover;flex:none;box-shadow:0 ${px(6)} ${px(16)} rgba(0,0,0,.22)}
.thumb.blank{background:linear-gradient(140deg,#ff9d5c,#e0523f)}
.meta{flex:1;min-width:0;display:grid;gap:calc(${px(3)} * var(--fit))}
.meta b{font-size:calc(${px(30)} * var(--fit));font-weight:700;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta i{font-style:normal;font-size:calc(${px(22)} * var(--fit));font-weight:500;color:${t.mute};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Long upload titles shrink instead of cutting off mid-word, which reads as a mistake on a poster. */
li.long .meta b{font-size:calc(${px(cols === 2 ? 21 : 25)} * var(--fit))}
.d{font-size:calc(${px(21)} * var(--fit));font-weight:600;color:${t.mute};font-variant-numeric:tabular-nums}

footer{margin-top:${px(22)};padding-top:${px(22)};border-top:1px solid ${t.line};display:flex;align-items:center;
  justify-content:space-between;font-size:${px(21)};color:${t.mute};font-weight:600}
.tag{display:flex;align-items:center;gap:${px(12)}}
.tag .mark{border-radius:${px(9)}}
</style></head>
<body><div class="poster">
  <header>
    <span class="brand">${logoMark(Math.round(60 * s))}<span class="word"><b>Lahn</b></span></span>
    <span class="stats">${tracks.length} songs · ${total} min</span>
  </header>
  <div class="head">
    <div><h1>${esc(TITLE)}</h1><p class="by">${esc(BYLINE)}</p></div>
    <p class="now">now spinning<b>${esc(hero.title)}</b>${esc(hero.artist)}</p>
  </div>
  <main class="body">
    <div class="stage">${turntable(hero, t.shadow)}</div>
    <ol class="tracks">${tracks.map((track, i) => row(track, i, cols === 2 ? 24 : 30)).join('')}</ol>
  </main>
  <footer>
    <span class="tag">${logoMark(Math.round(34 * s))} made with Lahn — Somali songs, podcasts &amp; lessons</span>
    <span>created by Maryam J.</span>
  </footer>
</div>
<script>
/* The library grows, the canvas does not. Shrink the record and the rows until the list fits,
   then drop the overflow into a "+N more" line so nothing is ever cut mid-word.
   main() calls this once the web fonts have landed, so it measures the real layout. */
window.__refit = () => {
  const poster = document.querySelector('.poster');
  const area = document.querySelector('.body');
  const list = document.querySelector('.tracks');
  const rows = () => [...list.querySelectorAll('li')];
  const fits = () => {
    const b = area.getBoundingClientRect();
    return rows().every((li) => {
      const r = li.getBoundingClientRect();
      return r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
    });
  };
  for (let i = 0; i < 14 && !fits(); i++) {
    /* Tighten the rows first; the record is the poster's face, so it only gives ground after. */
    poster.style.setProperty('--fit', Math.max(0.7, 1 - (i + 1) * 0.05));
    poster.style.setProperty('--dfit', Math.max(0.55, 1 - Math.max(0, i - 5) * 0.1));
  }
  let hidden = 0;
  while (!fits() && rows().length > 1) {
    rows().at(-1).remove();
    hidden++;
  }
  if (hidden) {
    const more = document.createElement('li');
    more.className = 'more';
    const say = () => { more.textContent = '+ ' + hidden + ' more ' + (hidden === 1 ? 'song' : 'songs'); };
    say();
    list.append(more);
    while (!fits() && rows().length > 2) {
      rows().at(-2).remove();
      hidden++;
      say();
    }
  }
  return { hidden, scale: Number(getComputedStyle(poster).getPropertyValue('--fit')) };
};
</script>
</body></html>`;
}

/* ---------------------------------------------------------------- render */

async function main() {
  const tracks = readLibrary();
  if (!tracks.length) throw new Error('the library is empty — add a song first');
  mkdirSync(TMP, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  for (const format of FORMATS) {
    const file = path.join(TMP, `${format.id}-${format.theme}.html`);
    writeFileSync(file, html(format, tracks));
    await page.setViewportSize({ width: format.w, height: format.h });
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const shrunk = await page.evaluate(() => window.__refit());

    const fit = await page.evaluate(() => {
      const box = document.querySelector('.poster').getBoundingClientRect();
      const outside = [...document.querySelectorAll('.tracks li, .head, footer')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > box.bottom + 1 || r.top < box.top - 1;
      }).length;
      const cut = [...document.querySelectorAll('.meta b, .meta i')].filter((el) => el.scrollWidth > el.clientWidth + 1).length;
      return { outside, cut };
    });
    const name = `lahn-playlist-${format.id}-${format.theme}.png`;
    await page.locator('.poster').screenshot({ path: path.join(OUT, name) });
    console.log(
      `${name}  ${format.w}x${format.h}  ${fit.outside || fit.cut ? `⚠ ${fit.outside} outside frame, ${fit.cut} truncated` : '✓ fits'}` +
        (shrunk.hidden ? ` · ${shrunk.hidden} song(s) folded into "+ more"` : shrunk.scale < 1 ? ` · rows at ${Math.round(shrunk.scale * 100)}%` : '')
    );
  }

  await browser.close();
  rmSync(TMP, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
