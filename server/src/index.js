import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { APP_VERSION, DB_FILE, LIBRARY_DIR, PORT, WEB_DIST, tools } from './config.js';
import { closeDb, stats } from './db.js';
import { ensureLibraryDirs, pruneMissing, scanLibrary } from './library.js';
import { createApi } from './api.js';
import { failInterruptedJobs } from './jobs.js';
import { seedChannels } from './channels.js';
import { lanAddresses } from './net.js';
import { log } from './log.js';

const BANNER = `
  ${'▄▄'.repeat(2)}   L A H N
  ████  ██        Somali songs, podcasts & lessons
  ██    ██        browse the shelves, keep the audio
  ▀▀▀▀  ▀▀
  Created by Maryam J.
`;

async function main() {
  ensureLibraryDirs();
  const interrupted = failInterruptedJobs();
  if (interrupted) log.warn(`${interrupted} download(s) were cut off by a restart — marked as failed`);

  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'range, content-type');
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  const placeholder = (_req, res) =>
    res.type('html').send(`<body style="font:16px/1.6 system-ui;background:#f6f5f3;color:#1a1a1a;padding:40px;max-width:560px">
        <h1>Laxan server is running ♫</h1>
        <p>The interface hasn't been built yet. Run <code>npm run dev</code> for the dev UI, or <code>npm start</code> to build it.</p>
        <p>API health: <a href="/api/health">/api/health</a></p></body>`);

  // Checked per request so a build appearing after boot is served without a restart.
  app.use('/api', createApi());
  app.use(express.static(WEB_DIST, { index: false, maxAge: '5m' }));
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    const index = path.join(WEB_DIST, 'index.html');
    if (!existsSync(index)) return placeholder(req, res);
    return res.sendFile(index);
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(BANNER);
    log.ok(`Laxan v${APP_VERSION} is up`);
    log.info('library ', LIBRARY_DIR);
    log.info('database', DB_FILE);
    log.info('this PC ', `http://localhost:${PORT}`);
    for (const net of lanAddresses()) log.info('on Wi-Fi', `http://${net.address}:${PORT}  (${net.name})`);

    const t = tools();
    if (!t.ytDlp) log.warn('yt-dlp not found — pasting links will fail. Run: winget install yt-dlp.yt-dlp');
    if (!t.ffmpeg) log.warn('ffmpeg not found — audio conversion will fail. Run: winget install Gyan.FFmpeg');
    const s = stats();
    log.brand(`${s.tracks ?? 0} song(s) · ${s.artists ?? 0} artist(s) · ${s.playlists ?? 0} playlist(s)`);
    if (s.tracks) log.info('tip: open the address above on your phone (same Wi-Fi) to listen');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') log.error(`port ${PORT} is already in use — is Laxan already open in another window?`);
    else log.error(err.message);
    process.exitCode = 1;
  });

  scanLibrary()
    .then(({ added }) => {
      if (added) log.ok(`found ${added} audio file(s) already in your library folder`);
    })
    .catch((err) => log.warn('library scan skipped:', err.message));
  pruneMissing();

  const seeded = seedChannels();
  if (seeded) log.info(`${seeded} starter channel(s) added — open Channels to pull their lists`);

  const shutdown = () => {
    log.info('closing Laxan…');
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  log.error(err.stack || err.message);
  process.exitCode = 1;
});
