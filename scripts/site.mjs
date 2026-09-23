/* Assemble the public site: the landing page on top, the running preview underneath it at /app.
   Run: npm run demo:bake && npm run demo:build && npm run site */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const APP = path.join(ROOT, 'web', 'dist-demo');
const OUT = path.join(SITE, 'dist');

const fail = (msg) => {
  console.log(msg);
  process.exit(1);
};

if (!existsSync(path.join(APP, 'index.html'))) fail('the preview build is missing — run: npm run demo:build');

/* A public Laxan streams two kinds of thing: audio its own source hands over, and a tap that
   hands the listener to the artist's own page. What it must never do is carry scraped audio —
   a file we pulled off someone else's server and put on ours. */
const demoPath = path.join(APP, 'demo.json');
if (!existsSync(demoPath)) fail('the preview build has no demo.json — run: npm run demo:bake && npm run demo:build');
const payload = JSON.parse(readFileSync(demoPath, 'utf8'));
const scraped = payload.items.filter((i) => /youtube|youtu\.be|googlevideo|ytimg/i.test(i.audio ?? ''));
if (scraped.length) fail(`${scraped.length} items stream scraped audio — refusing to assemble`);
const linkless = payload.items.filter((i) => !i.audio && !i.link);
if (linkless.length) fail(`${linkless.length} items can neither play nor hand off to their source`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(path.join(OUT, 'app'), { recursive: true });

for (const file of ['index.html', 'styles.css', 'site.js', 'icon.svg', 'apple-touch-icon.png']) {
  if (!existsSync(path.join(SITE, file))) fail(`missing site/${file}`);
  cpSync(path.join(SITE, file), path.join(OUT, file));
}
cpSync(path.join(SITE, 'fonts'), path.join(OUT, 'fonts'), { recursive: true });
cpSync(APP, path.join(OUT, 'app'), { recursive: true });

const bytes = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = path.join(dir, e.name);
    return sum + (e.isDirectory() ? bytes(p) : statSync(p).size);
  }, 0);

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const landing = bytes(OUT) - bytes(path.join(OUT, 'app'));
const onChannel = payload.items.filter((i) => i.link && !i.audio).length;
console.log(`\nsite/dist ready:`);
console.log(`  landing  ${mb(landing)}`);
console.log(
  `  app/     ${mb(bytes(path.join(OUT, 'app')))}  (${payload.items.length - onChannel} streams in-house, ${onChannel} go to their own channel, ${new Set(payload.items.map((i) => i.channel)).size} sources)`
);
