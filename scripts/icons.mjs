import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const PUB = path.resolve('web/public');
const OUT = PUB;
mkdirSync(OUT, { recursive: true });

const targets = [
  { src: 'icon.svg', out: 'icon-192.png', size: 192 },
  { src: 'icon.svg', out: 'icon-512.png', size: 512 },
  { src: 'icon-maskable.svg', out: 'icon-maskable-512.png', size: 512 },
  { src: 'icon-maskable.svg', out: 'apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();

for (const { src, out, size } of targets) {
  const svg = readFileSync(path.join(PUB, src), 'utf8')
    .replace(/\s(?:width|height)="\d+"/g, '')
    .replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}svg{display:block}</style>${svg}`);
  await page.locator('svg').screenshot({ path: path.join(OUT, out) });
  console.log('wrote', out, `${size}x${size}`);
}

await browser.close();
