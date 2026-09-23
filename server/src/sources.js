import { createHash } from 'node:crypto';

/**
 * Two catalogues that publish their audio for other people to play: podcast RSS, whose
 * enclosures exist so aggregators can stream them, and mp3quran.net, whose whole purpose is
 * distributing recitation. Neither one is scraped from a video site, so a build that carries
 * only these is a build that can be put in front of strangers.
 *
 * Both hand back the same rows the YouTube sources do, plus one field of their own: `audio`,
 * a straight link to the file. Anything with that skips yt-dlp entirely.
 */

/* Some podcast hosts refuse a request with no agent on it, and none of them like an empty one. */
const UA = 'Mozilla/5.0 (compatible; Laxan/0.1; personal music app)';
const TIMEOUT_MS = 30000;

async function body(url, as = 'text') {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: as === 'json' ? 'application/json' : 'application/rss+xml, application/xml, text/xml, */*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };

/* A feed can carry an entity that is not a codepoint, and one bad episode title is not a reason
   for the whole programme to disappear from her shelves. */
const point = (n) => {
  try {
    return String.fromCodePoint(n);
  } catch {
    return ' ';
  }
};

const strip = (s) =>
  String(s ?? '')
    .replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => point(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_m, code) => point(Number(code)))
    .replace(/&(\w+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();

const one = (re, block) => re.exec(block)?.[1] ?? '';

/** "4281", "00:35:11" and "17:36" are all the same field in the wild. */
export function parseDuration(value) {
  const s = String(value ?? '').trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const parts = s.split(':').map((p) => Number(p));
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/* An episode id has to survive being a cache filename and a shelf key, so it is a hash of the
   enclosure rather than the host's own fragment-y url. */
const hash = (s) => createHash('sha1').update(String(s)).digest('hex').slice(0, 14);

/**
 * One podcast feed, newest episodes first. `show` names the source the shelf rows fall back to,
 * since an episode with no author of its own belongs to the programme.
 */
export async function rssUploads(url, { limit = 40, kind = null } = {}) {
  const xml = await body(url);
  const feedImage =
    one(/<itunes:image[^>]*?\bhref="([^"]+)"/i, xml) || one(/<image[\s\S]{0,400}?<url>\s*([^<\s]+)\s*<\/url>/i, xml);
  const show = strip(one(/<title>([\s\S]*?)<\/title>/i, xml)) || 'Podcast';

  const items = xml
    .split(/<item[\s>]/)
    .slice(1, limit + 1)
    .map((chunk) => {
      const block = chunk.split(/<\/item>/i)[0];
      const audio = /<enclosure[^>]*?\burl="([^"]+)"[^>]*>/i.exec(block)?.[1];
      if (!audio || !/\.(mp3|m4a|aac|opus|ogg|wav)(\?|$)/i.test(audio)) return null;
      const date = new Date(one(/<pubDate>\s*([^<\s][^<]*)</i, block));
      const art = one(/<itunes:image[^>]*?\bhref="([^"]+)"/i, block) || feedImage;
      const rawTitle = one(/<title>([\s\S]*?)<\/title>/i, block);
      return {
        id: `e${hash(audio)}`,
        /* A surah's own name is what a Somali listener looks for; the English note some feeds
           print beside it belongs on a book spine, not on a shelf row. */
        title: (kind === 'quran' ? surahName(rawTitle) : strip(rawTitle)) || show,
        url: audio,
        audio,
        duration: parseDuration(one(/<itunes:duration>([\s\S]*?)<\/itunes:duration>/i, block)),
        thumbnail: art || null,
        uploadedAt: Number.isFinite(date?.getTime()) ? date.getTime() : 0,
      };
    })
    .filter(Boolean);

  if (!items.length) throw new Error(`No playable episodes came back from ${new URL(url).host}.`);
  return { name: show, image: feedImage || null, entries: items };
}

/* The reciter list is one call for every Quran source on disk, and it is a megabyte of it, so
   the sources share the answer instead of each asking for their own. */
const API = 'https://mp3quran.net/api/v3';
const SHARE_MS = 12 * 60 * 60 * 1000;
const shared = new Map();

async function sharedList(which) {
  const hit = shared.get(which);
  if (hit && Date.now() - hit.at < SHARE_MS) return hit.data;
  const data = await body(`${API}/${which}?language=eng`, 'json');
  shared.set(which, { at: Date.now(), data });
  return data;
}

const pad = (n) => String(n).padStart(3, '0');

/* mp3quran's English list prints a gloss beside the name — "Al-Mujadilah ( She That Disputeth )".
   The transliteration is what a Somali listener calls the surah, so the note after it is dropped
   rather than shown as part of the title. */
const surahName = (value) => strip(value).replace(/\s*\(.*$/, '').trim();

/* A mushaf is one narration of one reciter on one server, and the servers do not all name their
   files the same way — Hafs Murattal is the one Laxan asks for, and the list of surah numbers
   the server actually holds rides along with it. */
const preferred = (moshaf) =>
  moshaf.find((m) => /hafs/i.test(m.name) && /murattal/i.test(m.name)) ??
  moshaf.find((m) => /murattal/i.test(m.name)) ??
  moshaf[0];

/**
 * One reciter's full mushaf, surah by surah. The source url carries the reciter's own id, which
 * is what makes a shelf row's link stable when the server behind it moves.
 */
export async function quranUploads(url) {
  const reciterId = Number(/\/reciters\/(\d+)/.exec(url)?.[1]);
  const [{ reciters }, { suwar }] = await Promise.all([sharedList('reciters'), sharedList('suwar')]);
  const reciter = reciters.find((r) => r.id === reciterId);
  if (!reciter) throw new Error('That reciter is not on mp3quran.net any more.');
  const mushaf = preferred(reciter.moshaf ?? []);
  if (!mushaf?.server) throw new Error(`${reciter.name} has no audio server listed.`);

  const names = new Map(suwar.map((s) => [Number(s.id), surahName(s.name)]));
  const numbers = String(mushaf.surah_list ?? '')
    .split(',')
    .map((n) => Number(n.trim()))
    .filter((n) => n >= 1 && n <= 114);
  const surahs = numbers.length ? numbers : Array.from({ length: mushaf.surah_total || 114 }, (_, i) => i + 1);

  const entries = surahs.map((n) => {
    const audio = `${mushaf.server}${pad(n)}.mp3`;
    return {
      id: `s${pad(n)}`,
      title: `${n}. ${names.get(n) ?? `Surah ${n}`}`,
      url: audio,
      audio,
      /* mp3quran publishes no lengths; the file says so the moment it starts, and the player
         reads that off the media element. */
      duration: 0,
      thumbnail: null,
      uploadedAt: 0,
    };
  });

  return { name: reciter.name, image: null, entries };
}

export const DRIVERS = { rss: rssUploads, quran: quranUploads };

/** Anything that is not a scraped video is fair to stream in public. */
export const isLicensed = (driver) => driver !== 'youtube';
