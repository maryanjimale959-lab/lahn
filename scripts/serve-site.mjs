/* Look at the built site before it goes anywhere: the landing page at /, the running preview at
   /app. It answers on the whole network on purpose, so the phone can be tested with the real thing
   rather than a photograph. Nothing here touches the library or the database. */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site', 'dist');
const PORT = Number(process.env.LAHN_SITE_PORT ?? 4173);

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
  console.log('site/dist is empty — run: npm run site');
  process.exit(1);
}

const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${PORT}`).pathname);
  const wanted = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const file = path.join(DIST, wanted.replace(/^\/+/, ''));
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
});

const lan = Object.values(networkInterfaces())
  .flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`landing  http://127.0.0.1:${PORT}/`);
  console.log(`app      http://127.0.0.1:${PORT}/app/`);
  if (lan) console.log(`phone    http://${lan}:${PORT}/   (same Wi-Fi)`);
});
