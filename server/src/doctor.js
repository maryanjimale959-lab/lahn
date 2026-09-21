import { existsSync } from 'node:fs';
import { DB_FILE, LIBRARY_DIR, PORT, WEB_DIST, tools } from './config.js';
import { stats } from './db.js';
import { lanAddresses } from './net.js';
import { log } from './log.js';

const t = tools();
const rows = stats();

const line = (label, value) => log.info(label.padEnd(11), value);

console.log('');
log.brand('Lahn doctor');
console.log('');
line('yt-dlp', t.ytDlp ?? 'MISSING — winget install yt-dlp.yt-dlp');
line('ffmpeg', t.ffmpeg ?? 'MISSING — winget install Gyan.FFmpeg');
line('ffprobe', t.ffprobe ?? 'MISSING (comes with ffmpeg)');
line('library', `${LIBRARY_DIR} ${existsSync(LIBRARY_DIR) ? '' : '(not created yet)'}`);
line('database', DB_FILE);
line('web build', existsSync(WEB_DIST) ? WEB_DIST : 'not built yet — npm run build');
console.log('');
line('songs', rows.tracks ?? 0);
line('artists', rows.artists ?? 0);
line('albums', rows.albums ?? 0);
line('playlists', rows.playlists ?? 0);
line('on disk', `${(((rows.bytes ?? 0) / 1024 / 1024) | 0).toLocaleString()} MB`);
console.log('');
line('this PC', `http://localhost:${PORT}`);
for (const net of lanAddresses()) line('phone needs', `http://${net.address}:${PORT}`);
console.log('');
