import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { all, get, newId, now, run, sortKey } from './db.js';
import { LIBRARY_DIR, LICENSED_ONLY } from './config.js';
import { log } from './log.js';
import { fetchBinary, listUploads } from './ytdlp.js';
import { DRIVERS, isLicensed } from './sources.js';

const CACHE_MS = 6 * 60 * 60 * 1000;
const LIMIT = 24;

/**
 * The artists Laxan opens with. Every one of these was resolved against YouTube by hand: a
 * `channel` is an active channel of her own, a `query` is what stands in for the great voices
 * who never had one — K'naan, Magool, Mooge, Saado Cali — so their recordings still play.
 * `a-<slug>` is both the shelf their rows land on and the id their profile answers to.
 */
export const ARTISTS = [
  { slug: 'hodan-abdirahman', name: 'Hodan Abdirahman', channel: 'UCppbbj2vr429AeoSAQOq6hw' },
  { slug: 'qamar-suugaani', name: 'Qamar Suugaani', channel: '@Qamarsuugaani-31' },
  { slug: 'abdirashid-qaraare', name: 'Abdirashid Qaraare', channel: 'UCDNlWZsg_3hC4uz9sjd_8yw' },
  { slug: 'aar-maanta', name: 'Aar Maanta', channel: 'UCaNeG9iQFRvUFm-hSB4XXqg' },
  { slug: 'hanad-bandz', name: 'Hanad Bandz', channel: '@hanadbandz' },
  { slug: 'ilkacase', name: 'Ilkacase', channel: '@IlkacaseQays' },
  { slug: 'sharma-boy', name: 'Sharma Boy', channel: '@SharmaBoy' },
  { slug: 'yasin-the-don', name: 'Yasin The Don', channel: 'UCln7wI3zoFS2uG8eNJUQQMw' },
  { slug: 'amin-yare', name: 'Amin Yare', channel: '@aminyare' },
  { slug: 'abwaan-qorane', name: 'Abwaan Qorane', channel: '@AbwaanQorane' },
  { slug: 'knaan', name: "K'naan", query: "K'naan official music video" },
  { slug: 'waaberi', name: 'Hobollada Waaberi', query: 'Hobollada Waaberi hees cusub' },
  { slug: 'magool', name: 'Magool', query: 'Magool heeso codkii Hoobiyaha' },
  { slug: 'mooge', name: 'Axmed Mooge Liibaan', query: 'Mohamed Mooge Liibaan heeso' },
  { slug: 'saado-cali', name: 'Saado Cali Warsame', query: 'Saado Cali Warsame heeso' },
  { slug: 'sahra-halgan', name: 'Sahra Halgan', query: 'Sahra Halgan heeso' },
  { slug: 'abdi-aweys', name: 'Abdi Aweys', query: 'Cabdi Aweys hees' },
  { slug: 'xaawo-taabo', name: 'Xaawo Taabo', query: 'Xaawo Taabo heeso somali' },
  { slug: 'mursal-muuse', name: 'Mursal Muuse', query: 'Mursal Muuse hees cusub' },
  { slug: 'ladan-maria', name: 'Ladan Maria', query: 'Ladan Maria hees jaceyl' },
];

export const artistShelf = (slug) => `a-${slug}`;

const V = '/videos';
/* A channel id needs `/channel/<id>`, a handle already carries its own `@`. */
const vid = (idOrHandle) =>
  `https://www.youtube.com/${idOrHandle.startsWith('UC') ? `channel/${idOrHandle}` : idOrHandle}${V}`;

/* mp3quran.net's own address for one reciter, which is the stable thing about them — the server
   their audio sits on changes between narrations, their id does not. */
const Q = (id) => `https://mp3quran.net/api/v3/reciters/${id}`;

/**
 * Laxan's whole catalogue comes from these sources: the labels, studios and talk shows that
 * actually post Somali and Arabic audio, plus a rolling saved search per shelf so new names
 * still turn up. Every source names the shelf its rows land on, which is what keeps
 * recitation out of the podcast rows and the Arabic shelves on their own.
 */
const DEFAULTS = [
  /* --- new Somali releases, carried by the labels that release them --- */
  { name: 'Somali Swiss', url: vid('UC5_wT-mKh744DXK8HatMIUg'), kind: 'song', shelf: 'music' },
  { name: 'Matt An Pro', url: vid('UCYYe7qoWt51MerqL6ViWNEw'), kind: 'song', shelf: 'music' },
  { name: 'Waqal Studio', url: vid('UC86UcBB1qofuGk9as8IhpMQ'), kind: 'song', shelf: 'music' },
  { name: 'Maahir Media', url: vid('UCtPYCOi_MVTXAqlrbDNv1YQ'), kind: 'song', shelf: 'music' },
  { name: 'Wardi Pro', url: vid('UCDQ-Yz7Aq7_e-sYaWydWZzA'), kind: 'song', shelf: 'music' },
  { name: 'Kaafi Studio', url: vid('UCAo2VeJbwv0O5ll9hApBkPw'), kind: 'song', shelf: 'music' },
  { name: 'Digaale Music', url: vid('UCoU47ivszBaJzOKWRdNZI-A'), kind: 'song', shelf: 'music' },
  { name: 'Tusmo Films', url: vid('@Tusmofilms'), kind: 'song', shelf: 'music' },
  { name: 'Balanbaalis Studio', url: vid('UC4X3F5-J63cqAiIG6i5iMDQ'), kind: 'song', shelf: 'music' },
  { name: 'Shareeco Studio', url: vid('UCNSeo5C4SIghbn4y7lkL3rg'), kind: 'song', shelf: 'music' },
  { name: 'Fankii Hore', url: vid('@Fankiihore_Qaraami'), kind: 'song', shelf: 'music' },
  { name: 'Heeso Soomaali', url: 'ytsearch40:heeso somali cusub 2026', kind: 'song', shelf: 'music' },
  /* --- Somali hip-hop --- */
  { name: 'Minnesota Cold TV', url: vid('@MinnesotaColdTv'), kind: 'song', shelf: 'rap' },
  { name: 'Nomadic Status', url: vid('@NomadicStatus'), kind: 'song', shelf: 'rap' },
  { name: 'Rap Soomaali', url: 'ytsearch40:rap somali cusub 2026', kind: 'song', shelf: 'rap' },
  /* --- love songs --- */
  { name: 'Wareer Music', url: vid('@wareermusic'), kind: 'song', shelf: 'love' },
  { name: 'Gallad Studio', url: vid('@GalladStudio'), kind: 'song', shelf: 'love' },
  { name: 'Zakariyow', url: vid('@zakariyoww'), kind: 'song', shelf: 'love' },
  { name: 'Dhaad Media', url: vid('@DhaadMedia'), kind: 'song', shelf: 'love' },
  { name: 'Liibaan Jama', url: vid('UC4aCTV9PWmC9_89kxpzAgpA'), kind: 'song', shelf: 'love' },
  { name: 'Heeso Jaceyl', url: 'ytsearch40:heeso jacayl xul ah 2026 audio', kind: 'song', shelf: 'love' },
  /* --- podcasts and talk shows --- */
  { name: 'Abdijaliil Show', url: vid('@Abdijalilshow'), kind: 'podcast', shelf: 'podcasts' },
  { name: 'Madari Podcast', url: vid('@madaripodcast'), kind: 'podcast', shelf: 'podcasts' },
  { name: 'Guntiino Podcast', url: vid('@GuntiinoPodcast'), kind: 'podcast', shelf: 'podcasts' },
  { name: 'Sultan Films', url: vid('@sultaanfilms'), kind: 'podcast', shelf: 'podcasts' },
  { name: 'Moon Media', url: vid('@Moonmediamm'), kind: 'podcast', shelf: 'podcasts' },
  { name: 'Ridhwan Issack', url: vid('@ridhwanissack'), kind: 'podcast', shelf: 'podcasts' },
  { name: 'Sahan Podcast', url: vid('@SahanPodcast97'), kind: 'podcast', shelf: 'podcasts' },
  { name: 'Business Connect TV', url: vid('@businessconnecttv'), kind: 'podcast', shelf: 'podcasts' },
  { name: 'Somali Voice', url: vid('@SomaliVoice11'), kind: 'podcast', shelf: 'podcasts' },
  /* --- Quran, on its own: it is neither a podcast nor a book --- */
  { name: 'Daacad Production', url: vid('@DaacadProduction'), kind: 'quran', shelf: 'quran' },
  { name: 'Sheikh Ahmed Sheikh', url: vid('@SHEEKHAHMEDSHEIKH'), kind: 'quran', shelf: 'quran' },
  { name: 'Abdullah Hafs', url: vid('@ABDULAHHAFS'), kind: 'quran', shelf: 'quran' },
  { name: 'Beautiful Recitation', url: vid('@BeautifulQuranRecitation'), kind: 'quran', shelf: 'quran' },
  { name: 'Tadabbur Daily', url: vid('@tadabburdaily'), kind: 'quran', shelf: 'quran' },
  { name: 'Sheikh Maher', url: vid('UCfimgqx1TcWuLkgcrm2Rkdw'), kind: 'quran', shelf: 'quran' },
  { name: 'Islam Sobhi', url: vid('@islam_sobhi'), kind: 'quran', shelf: 'quran' },
  { name: 'Mosad Mushaf', url: vid('UCaT_sepikLcg8q_0Qvdf0Ng'), kind: 'quran', shelf: 'quran' },
  { name: 'Quraan Soomaali', url: 'ytsearch40:qur\'aan somali tilaawad dheer', kind: 'quran', shelf: 'quran' },
  { name: 'Tilaawod Carabi', url: 'ytsearch40:تلاوات خاشعة للقرآن الكريم كاملة', kind: 'quran', shelf: 'quran' },
  /* --- sheeko iyo kiisaska --- */
  { name: 'DADWEYNAHA', url: vid('@DADWEYNAHA'), kind: 'story', shelf: 'stories' },
  { name: 'Sawda Qaalib', url: vid('@sawdamqaalib'), kind: 'story', shelf: 'stories' },
  { name: 'Qiso Central', url: vid('@QisoCentral'), kind: 'story', shelf: 'stories' },
  { name: 'Sawda Bilan', url: vid('@SawdaBillan'), kind: 'story', shelf: 'stories' },
  { name: 'Sheeko Hub', url: vid('@Sheeko-Hub'), kind: 'story', shelf: 'stories' },
  { name: 'Higsi No1', url: vid('UCQJ0SEOwKg8b2TNuwKZxHoQ'), kind: 'story', shelf: 'stories' },
  { name: 'Suldaan Stories', url: vid('@SUL-DAAN'), kind: 'story', shelf: 'stories' },
  /* --- casharro --- */
  { name: 'Dugsiiye', url: vid('@dugsiiye'), kind: 'lesson', shelf: 'lessons' },
  { name: 'Ogaansho', url: vid('@ogaansho'), kind: 'lesson', shelf: 'lessons' },
  { name: 'Hoyga Luqadaha', url: vid('@Hoygaluqadaha'), kind: 'lesson', shelf: 'lessons' },
  { name: 'English with Mima', url: vid('@EnglishwithMima'), kind: 'lesson', shelf: 'lessons' },
  { name: 'Abdullahi Qorshe', url: vid('@AbdullahiQorshe'), kind: 'lesson', shelf: 'lessons' },
  { name: 'Ikhlaas Lectures', url: vid('@alikhlaas-beneficiallectures'), kind: 'lesson', shelf: 'lessons' },
  /* --- buugaag la akhriyay --- */
  { name: 'Codka Ubax', url: vid('@CodkaUbax'), kind: 'book', shelf: 'books' },
  { name: 'IFIYE Audiobooks', url: vid('@Ifiye.somaliaudiobooks'), kind: 'book', shelf: 'books' },
  { name: 'IFIYE Talks', url: vid('@IFIYE-TALKS'), kind: 'book', shelf: 'books' },
  { name: 'Xoggoob', url: vid('@XOGGOOB'), kind: 'book', shelf: 'books' },
  { name: 'Qulasada Filimada', url: vid('@QulasadaFilimada'), kind: 'book', shelf: 'books' },
  { name: 'Buugaag Soomaali', url: 'ytsearch40:buugag somali la akhriyay cod', kind: 'book', shelf: 'books' },
  /* --- Arabic music --- */
  { name: 'Rotana', url: vid('UCNhqvQMXIgRfjAGmxQqdNRw'), kind: 'song', shelf: 'amusic' },
  { name: 'Mazzika', url: vid('@Mazzika'), kind: 'song', shelf: 'amusic' },
  { name: 'Ahlam', url: vid('UCoRF9Eqslz82_7whXnbhzRQ'), kind: 'song', shelf: 'amusic' },
  { name: 'Abdel Halim', url: vid('UClyQuhkEIYzujgAaR24ExZA'), kind: 'song', shelf: 'amusic' },
  { name: 'National Arab Orchestra', url: vid('@NationalArabOrchestra'), kind: 'song', shelf: 'amusic' },
  { name: 'طرب', url: 'ytsearch40:اغاني طرب قديمة', kind: 'song', shelf: 'amusic' },
  { name: 'أم كلثوم', url: 'ytsearch40:"أم كلثوم" أغنية كاملة', kind: 'song', shelf: 'amusic' },
  /* --- Arabic podcasts --- */
  { name: 'Thmanyah', url: vid('UCwjLh640nGXSGa9iHRS31ag'), kind: 'podcast', shelf: 'apodcast' },
  { name: 'Atheer', url: vid('UCMQ18I4n6ccOSNDLfdhrUbQ'), kind: 'podcast', shelf: 'apodcast' },
  { name: 'Nawafed', url: vid('UCBcLf1KYcb5h2j2GszqtihA'), kind: 'podcast', shelf: 'apodcast' },
  { name: 'Tanween', url: vid('UC2IhG2yHmAFYPqNZNMyOPkg'), kind: 'podcast', shelf: 'apodcast' },
  { name: 'Arabian Post', url: vid('UCdUp5vHINCdtZS31flL_prg'), kind: 'podcast', shelf: 'apodcast' },
  { name: 'بودكاست عربي', url: 'ytsearch40:بودكاست عربي حلقة طويلة', kind: 'podcast', shelf: 'apodcast' },
  /* --- the half that publishes its audio for reuse ---
     Recitation servers and podcast feeds. Everything above this line is scraped off YouTube,
     which is fine on her own Wi-Fi and is not something to hand a stranger; these are the rows
     a public Laxan keeps. Each one answers with a direct file link, so a tap on them starts at
     once instead of waiting on a converter. */
  { name: 'Abdul Basit', url: Q('51'), kind: 'quran', shelf: 'quran', driver: 'quran' },
  { name: 'Al-Minshawi', url: Q('112'), kind: 'quran', shelf: 'quran', driver: 'quran' },
  { name: 'Mishary Alafasy', url: Q('123'), kind: 'quran', shelf: 'quran', driver: 'quran' },
  { name: "Abu Bakr Al-Shatri", url: Q('4'), kind: 'quran', shelf: 'quran', driver: 'quran' },
  { name: 'Maher Al Meaqli', url: Q('102'), kind: 'quran', shelf: 'quran', driver: 'quran' },
  { name: 'Maher Shakhashero', url: Q('149'), kind: 'quran', shelf: 'quran', driver: 'quran' },
  { name: 'Tarjumaadda Quraanka', url: 'https://www.qurantranslations.net/podcast/Soomaali/Holy_Quran_in_the_Soomaali_Language.rss', kind: 'quran', shelf: 'quran', driver: 'rss' },
  { name: 'Maamul Wanaag', url: 'https://rss.buzzsprout.com/1805404.rss', kind: 'podcast', shelf: 'podcasts', driver: 'rss' },
  { name: 'Adeeg Wanaag', url: 'https://rss.buzzsprout.com/823555.rss', kind: 'podcast', shelf: 'podcasts', driver: 'rss' },
  { name: 'Hiloow', url: 'https://www.spreaker.com/show/5803165/episodes/feed', kind: 'podcast', shelf: 'podcasts', driver: 'rss' },
  { name: 'Garasho-wadaag', url: 'https://www.spreaker.com/show/5303135/episodes/feed', kind: 'podcast', shelf: 'podcasts', driver: 'rss' },
  { name: 'Miizaan', url: 'https://feeds.transistor.fm/miizaan', kind: 'podcast', shelf: 'podcasts', driver: 'rss' },
  { name: 'Hab Fikirka', url: 'https://feed.podbean.com/hilhod143/feed.xml', kind: 'podcast', shelf: 'podcasts', driver: 'rss' },
  { name: 'Diiwaanka Mahad', url: 'https://rss.buzzsprout.com/2448538.rss', kind: 'podcast', shelf: 'podcasts', driver: 'rss' },
  { name: 'Sheeko iyo Shaahid', url: 'https://rss.buzzsprout.com/2561549.rss', kind: 'story', shelf: 'stories', driver: 'rss' },
  { name: 'Buugaag Codka Ubax', url: 'https://rss.buzzsprout.com/721491.rss', kind: 'book', shelf: 'books', driver: 'rss' },
  { name: 'Duruus Manhaj', url: 'https://manhajonline.com/podcasts/sheekh-cabdilaahi-sheekh-xaashi/feed.xml', kind: 'lesson', shelf: 'lessons', driver: 'rss' },
  { name: 'Arabi Post', url: 'https://www.omnycontent.com/d/playlist/93ede1a5-f219-4562-a4af-b0c100d3da54/0ade4ea1-fb11-4f07-849d-b27400fd178b/8ce65e43-e7bd-492c-b928-b27400fd1c74/podcast.rss', kind: 'podcast', shelf: 'apodcast', driver: 'rss' },
  { name: 'afikra', url: 'https://feeds.simplecast.com/mQeVlZL1', kind: 'podcast', shelf: 'apodcast', driver: 'rss' },
  { name: 'عَلاقات', url: 'https://podcasts.files.bbci.co.uk/p09m6x31.rss', kind: 'podcast', shelf: 'apodcast', driver: 'rss' },
  { name: 'الأسبوع', url: 'https://feed.podbean.com/podcastsd/feed.xml', kind: 'podcast', shelf: 'apodcast', driver: 'rss' },
  ...ARTISTS.map((ar) => ({
    name: ar.name,
    url: ar.channel ? vid(ar.channel) : `ytsearch40:${ar.query}`,
    kind: 'song',
    shelf: artistShelf(ar.slug),
  })),
];

/**
 * What a listener can say they are into during sign-up. Each one is a shelf, and the ids are
 * the keys the app translates, so nothing here needs new strings per language.
 */
export const HOME_SHELVES = ['music', 'rap', 'love', 'podcasts', 'quran', 'stories', 'lessons', 'books', 'amusic', 'apodcast'];

export const INTERESTS = HOME_SHELVES.map((id) => ({ id, shelf: id }));

export const cleanInterests = (list) => {
  const known = new Set(INTERESTS.map((i) => i.id));
  return (Array.isArray(list) ? list : []).filter((id) => known.has(id)).slice(0, INTERESTS.length);
};

/* Sources from the very first cut that no Somali or Arabic listener asks for. */
const RETIRED = ['ABtalks', 'AJpluskibreet', 'm7ns', 'Alaraby-Tube', 'programmingwithmosh', 'WideBot'].map((h) => `https://www.youtube.com/@${h}/videos`);

/* Everything the seed writes is stamped with a shelf, so a shelf-less row is one she added
   by hand and none of the seed's business. Retired URLs go whatever shelf they carry. */
const seedOwned = (row) => Boolean(row.shelf) || RETIRED.includes(row.url);

/**
 * The catalogue on disk is allowed to drift from the catalogue on paper: a source renamed, a
 * search re-worded, an old build's row. On boot every DEFAULTS source takes the row that carries
 * its name, whatever url that row holds, and any seed-owned row left unclaimed is dropped — so
 * a shelf never ends up with two sources feeding it the same list. Rows with her own saves in
 * them are always kept.
 */
export function seedChannels() {
  const driverOf = (source) => source.driver ?? 'youtube';
  const byUrl = new Map(DEFAULTS.map((s) => [s.url, s]));
  const byName = new Map(DEFAULTS.map((s) => [sortKey(s.name), s]));
  const claimed = new Set();
  let changed = 0;

  const drop = (ch) => {
    const saves = get('SELECT COUNT(*) AS n FROM tracks WHERE channel_id = ?', ch.id).n;
    if (saves) return false;
    run('DELETE FROM channels WHERE id = ?', ch.id);
    changed += 1;
    return true;
  };

  /* A row that already carries the right url wins the source, so process those first. */
  const rows = all('SELECT id, url, name, kind, shelf, driver FROM channels').sort(
    (a, b) => Number(!byUrl.has(b.url)) - Number(!byUrl.has(a.url))
  );

  for (const ch of rows) {
    if (!seedOwned(ch)) continue;
    /* Matching on a name alone used to be enough, but a show can exist as both a channel and a
       feed — the feed must not reach over and retitle the channel that got there first. */
    const named = byName.get(sortKey(ch.name));
    const source = byUrl.get(ch.url) ?? (named && driverOf(named) === (ch.driver ?? 'youtube') ? named : null);
    try {
      /* Two rows for one source — the old build's name and the new one's url, say. The second
         is a duplicate and its name would collide with the first, so it goes. */
      if (!source || claimed.has(source.url)) {
        drop(ch);
        continue;
      }
      claimed.add(source.url);
      if (ch.url === source.url) {
        run('UPDATE channels SET name = ?, kind = ?, shelf = ?, sort_key = ?, driver = ? WHERE id = ?', source.name, source.kind, source.shelf ?? null, sortKey(source.name), driverOf(source), ch.id);
        continue;
      }
      /* A different url means a different list: the cached one has to go. */
      run('UPDATE channels SET url = ?, name = ?, kind = ?, shelf = ?, sort_key = ?, driver = ?, uploads = NULL, fetched_at = NULL WHERE id = ?', source.url, source.name, source.kind, source.shelf ?? null, sortKey(source.name), driverOf(source), ch.id);
      changed += 1;
    } catch (err) {
      log.warn(`starter source ${source?.name ?? ch.name} skipped:`, err.message);
    }
  }

  for (const source of DEFAULTS) {
    if (claimed.has(source.url)) continue;
    try {
      run('INSERT INTO channels (id, url, name, sort_key, kind, image, added_at, uploads, fetched_at, shelf, driver) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?, ?)', newId(), source.url, source.name, sortKey(source.name), source.kind, now(), source.shelf ?? null, driverOf(source));
      changed += 1;
    } catch (err) {
      log.warn(`starter source ${source.name} skipped:`, err.message);
    }
  }
  return changed;
}

const pending = new Map();
let warming = null;

/* A source that will not answer is asked again after a widening gap, not on every shelf read —
   otherwise a broken channel keeps the whole sweep running and the app never looks ready. The
   count lives in the database rather than in memory so a restart does not start hammering a
   dead feed all over again. */
const RETRY_MS = 10 * 60 * 1000;
const MAX_RETRY_MS = 24 * 60 * 60 * 1000;
const backoffMs = (fails) => Math.min(RETRY_MS * 2 ** Math.max(0, (fails ?? 0) - 1), MAX_RETRY_MS);

export function channelUrl(input) {
  const raw = String(input ?? '').trim().replace(/\s+/g, '');
  if (!raw) return null;
  const rest = raw.replace(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i, '');
  const handle = /^@[\w.-]{2,60}/.exec(rest)?.[0];
  if (handle) return `https://www.youtube.com/${handle}/videos`;
  const id = /^channel\/(UC[\w-]{6,})/.exec(rest)?.[1];
  if (id) return `https://www.youtube.com/channel/${id}/videos`;
  const custom = /^(?:c|user)\/([\w.-]{2,60})/.exec(rest)?.[1];
  if (custom) return `https://www.youtube.com/c/${custom}/videos`;
  return null;
}

function nameFromUrl(url) {
  return decodeURIComponent(/youtube\.com\/(@?[\w.-]+)/.exec(url)?.[1] ?? 'Channel').replace(/^@/, '');
}

/* Flat-playlist rows come back as "hq720_custom_N.jpg?sqp=…" links that browsers
   routinely refuse to render. hqdefault always exists, and object-fit:cover crops the
   letterbox bars off it, so a 16:9 card shows a clean 480px frame. */
function withPoster(entry) {
  const vid = /youtu(?:\.be\/|be\.com\/(?:watch\?v=|shorts\/|live\/|embed\/))([\w-]{11})/.exec(entry?.url ?? '')?.[1];
  return vid ? { ...entry, thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` } : entry;
}

function parse(uploads) {
  try {
    const list = JSON.parse(uploads ?? '[]');
    return Array.isArray(list) ? list.map(withPoster) : [];
  } catch {
    return [];
  }
}

/* YouTube hands back names like "DADWEYNAHA ," — trailing punctuation reads as a bug. */
const niceName = (name) => String(name ?? '').replace(/\s+/g, ' ').replace(/[\s,.;:!|·]+$/, '').trim();

/* One word for how a source is doing, so the Channels page can say it out loud. */
const healthOf = (channel) => {
  if (!channel.fetched_at) return channel.failed_at ? 'dead' : 'new';
  return channel.fails > 0 ? 'failing' : 'ok';
};

function row(channel) {
  const { uploads, fails, failed_at: failedAt, last_error: lastError, ok_at: okAt, ...rest } = channel;
  const list = parse(uploads);
  return {
    ...rest,
    name: niceName(rest.name),
    uploadCount: list.length,
    preview: list[0]?.thumbnail ?? null,
    isSearch: String(channel.url).startsWith('ytsearch'),
    licensed: isLicensed(channel.driver),
    health: healthOf(channel),
    fails: fails ?? 0,
    lastError: lastError ?? null,
    failedAt: failedAt ?? null,
    okAt: okAt ?? null,
  };
}

function savedIds() {
  return new Map(all('SELECT id, source_id FROM tracks WHERE source_id IS NOT NULL').map((t) => [t.source_id, t.id]));
}

export function listChannels() {
  const rows = all('SELECT * FROM channels ORDER BY LOWER(name) ASC');
  /* A published build does not show the scraped channels, so it should not list the ones it can
     never fill either — that is a page of sources asking after something with no room for it. */
  return (LICENSED_ONLY ? rows.filter((c) => isLicensed(c.driver)) : rows).map(row);
}

/** Counted rather than listed: this is the one number that says whether the catalog is whole. */
export function sourceHealth() {
  const rows = all('SELECT fetched_at, fails, driver FROM channels');
  const shown = LICENSED_ONLY ? rows.filter((c) => isLicensed(c.driver)) : rows;
  return {
    total: shown.length,
    failing: shown.filter((c) => c.fails > 0).length,
    dead: shown.filter((c) => !c.fetched_at && c.fails > 0).length,
    due: staleIds().length,
  };
}

export function channelById(id) {
  return get('SELECT * FROM channels WHERE id = ?', id) ?? null;
}

const CHANNEL_TRACKS = `SELECT t.*, a.name AS artist, al.title AS album
  FROM tracks t
  LEFT JOIN artists a ON a.id = t.artist_id
  LEFT JOIN albums al ON al.id = t.album_id
  WHERE t.channel_id = ?`;

export function channelUploads(id) {
  const channel = channelById(id);
  if (!channel) return null;
  const saved = savedIds();
  const uploads = parse(channel.uploads).map((u) => ({ ...u, savedTrackId: saved.get(u.id) ?? null }));
  return { channel: row(channel), uploads, fresh: isFresh(channel), tracks: all(`${CHANNEL_TRACKS} ORDER BY t.added_at DESC`, id) };
}

const isFresh = (channel) => Date.now() - (channel.fetched_at ?? 0) < CACHE_MS;

/**
 * Sources worth asking again: not fresh, and past the backoff their last failure earned them.
 * Each one comes back with the engine behind it, because the sweep runs the two kinds at
 * different speeds.
 */
function dueSources() {
  const due = all('SELECT id, shelf, fetched_at, fails, failed_at, driver FROM channels').filter((c) => {
    /* A build that will not show them has no reason to spend its refresh cycle on the scraped
       sources either. */
    if (LICENSED_ONLY && !isLicensed(c.driver)) return false;
    return !isFresh(c) && Date.now() - (c.failed_at ?? 0) >= backoffMs(c.fails);
  });
  const rank = (c) => (isLicensed(c.driver) ? -1 : c.shelf && c.shelf.startsWith('a-') ? 1 : 0);
  return due.sort((a, b) => rank(a) - rank(b));
}

function staleIds() {
  return dueSources().map((c) => c.id);
}

/** Everything the sources have published, newest first, with the shelf each row belongs to. */
export function catalog({ kind = null, shelf = null, q = null } = {}) {
  const saved = savedIds();
  const needle = q ? String(q).trim().toLowerCase() : null;
  const items = [];
  for (const channel of all('SELECT * FROM channels')) {
    if (LICENSED_ONLY && !isLicensed(channel.driver)) continue;
    if (kind && channel.kind !== kind) continue;
    if (shelf && channel.shelf !== shelf) continue;
    const name = niceName(channel.name);
    const licensed = isLicensed(channel.driver);
    for (const u of parse(channel.uploads)) {
      if (needle && !`${u.title} ${name}`.toLowerCase().includes(needle)) continue;
      items.push({
        key: `${channel.id}:${u.id}`,
        id: u.id,
        title: u.title,
        url: u.url,
        /* Set when the source hands out the file itself. Playback reads it and skips the
           converter, which is why these rows start the moment she taps them. */
        audio: u.audio ?? null,
        duration: u.duration,
        thumbnail: u.thumbnail,
        uploadedAt: u.uploadedAt,
        kind: channel.kind,
        shelf: channel.shelf,
        channelId: channel.id,
        channel: name,
        driver: channel.driver,
        licensed,
        savedTrackId: saved.get(u.id) ?? null,
      });
    }
  }
  return items.sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
}

const take = (list, n = 18) => list.slice(0, n);

/* Rows that carry their own file link come first within a shelf: they start the instant she
   taps, where a scraped video needs the converter first. The rest keeps the newest-first order
   the catalogue already came in with. */
const leadWithDirectPlay = (list) =>
  list.filter((i) => i.audio).concat(list.filter((i) => !i.audio));

/* A shelf is one screen of choices, not one programme's whole discography: no single source gets
   to fill it, so the six reciters behind the Quraan shelf all appear on it rather than the one
   whose episodes happen to carry the newest dates. */
const spread = (list, n = 18, perSource = 3) => {
  const used = new Map();
  const picked = [];
  const taken = new Set();
  for (const item of list) {
    if (picked.length === n) break;
    const key = item.channelId;
    if ((used.get(key) ?? 0) >= perSource) continue;
    used.set(key, (used.get(key) ?? 0) + 1);
    picked.push(item);
    taken.add(item.key);
  }
  /* A shelf with fewer sources than slots still fills up. */
  for (const item of list) {
    if (picked.length >= n) break;
    if (taken.has(item.key)) continue;
    picked.push(item);
  }
  return picked;
};

/* Home's top row is the mix she asked for, not one shelf shown twice: the shelves she picked
   take turns sending a row down, so it reads as her own rather than as a copy of the row under
   it. */
const weave = (rows) => {
  const out = [];
  for (let n = 0; out.length < 18; n += 1) {
    let any = false;
    for (const items of rows) {
      const item = items[n];
      if (item && !out.includes(item)) {
        out.push(item);
        any = true;
      }
    }
    if (!any) break;
  }
  return out;
};

/* Two saved searches can return the same upload; a shelf should never show it twice. The identity
   is the file or the page a row points at rather than its id, because six reciters all publish a
   surah 001 and collapsing those leaves the Quraan shelf with one voice on it. */
const face = (item) => item.audio ?? item.url ?? item.id;
const dedupe = (list) => {
  const seen = new Set();
  return list.filter((item) => !seen.has(face(item)) && seen.add(face(item)));
};

/**
 * The whole shelf page, in the order she should meet it. Nothing is dropped — she can scroll to
 * the bottom of any programme — but the sources take turns at the top, so one feed with recent
 * dates cannot hide the five reciters published behind the same shelf.
 */
export function shelfPage(shelf) {
  const list = dedupe(catalog({ shelf }));
  return spread(leadWithDirectPlay(list), list.length);
}

const VIDEO_ID = /^[\w-]{6,40}$/;
const SEARCH_MS = 30 * 60 * 1000;
const searches = new Map();

/**
 * A shelf row for something nobody has indexed yet: ask YouTube once and hold the answer for
 * half an hour. The rows play through the same `search:<id>` key the player already uses.
 */
export async function liveSearch(query, { limit = 15 } = {}) {
  if (LICENSED_ONLY) return [];
  const needle = String(query ?? '').trim();
  if (needle.length < 3) return [];
  const hit = searches.get(needle.toLowerCase());
  if (hit && Date.now() - hit.at < SEARCH_MS) return hit.items;
  const info = await listUploads(`ytsearch${limit}:${needle}`, { limit });
  const saved = savedIds();
  const items = info.entries
    .filter((u) => VIDEO_ID.test(String(u.id ?? '')))
    .map((u) => ({
      key: `search:${u.id}`,
      id: u.id,
      title: u.title,
      url: u.url,
      duration: u.duration,
      thumbnail: u.thumbnail,
      uploadedAt: u.uploadedAt,
      kind: 'song',
      shelf: null,
      channelId: 'search',
      channel: needle,
      savedTrackId: saved.get(u.id) ?? null,
    }));
  searches.set(needle.toLowerCase(), { at: Date.now(), items });
  return items;
}

/** One shelf item by its "channelId:videoId" key — what playback is asked to fetch. */
export function itemByKey(key) {
  const [channelId, videoId] = String(key ?? '').split(':');
  if (channelId === 'search') {
    if (!VIDEO_ID.test(String(videoId ?? ''))) return null;
    for (const hit of searches.values()) {
      const found = hit.items.find((i) => i.id === videoId);
      if (found) return found;
    }
    return {
      key: `search:${videoId}`,
      id: videoId,
      title: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      duration: 0,
      thumbnail: null,
      kind: 'song',
      shelf: null,
      channelId: 'search',
      channel: '',
    };
  }
  const channel = channelId ? channelById(channelId) : null;
  if (!channel) return null;
  if (LICENSED_ONLY && !isLicensed(channel.driver)) return null;
  const found = parse(channel.uploads).find((u) => u.id === videoId || String(u.url).includes(videoId));
  if (!found) return null;
  return {
    key: `${channel.id}:${found.id}`,
    id: found.id,
    title: found.title,
    url: found.url,
    audio: found.audio ?? null,
    duration: found.duration,
    thumbnail: found.thumbnail,
    kind: channel.kind,
    shelf: channel.shelf,
    channelId: channel.id,
    channel: niceName(channel.name),
    driver: channel.driver,
    licensed: isLicensed(channel.driver),
  };
}

/**
 * The shelf rows. `picked` answers what the listener said she is into during sign-up, and Home
 * shows those rows alone, so choosing podcasts and recitation never hands back the whole
 * catalogue. Artists are not a shelf: they get their own grid.
 */
export function shelves(interests = []) {
  const items = catalog();
  const byShelf = (shelf) => dedupe(items.filter((i) => i.shelf === shelf));
  const picked = new Set(interests);

  const rows = HOME_SHELVES.map((id) => ({ id, items: spread(leadWithDirectPlay(byShelf(id))) }))
    .filter((shelf) => shelf.items.length)
    .sort((a, b) => Number(picked.has(b.id)) - Number(picked.has(a.id)));

  const mine = weave(rows.filter((row) => picked.has(row.id)).map((row) => row.items));
  const out = [{ id: 'foryou', items: take(mine) }, { id: 'fresh', items: take(dedupe(items)) }, ...rows].filter((shelf) => shelf.items.length);

  return {
    shelves: out,
    picked: rows.filter((row) => picked.has(row.id)).map((row) => row.id),
    ready: !warming && !staleIds().length,
    total: dedupe(items).length,
  };
}

/** Everything about one artist: the shelf behind her name, plus the art of her top upload. */
export function artistBySlug(slug) {
  const artist = ARTISTS.find((ar) => ar.slug === slug);
  if (!artist) return null;
  const rows = catalog({ shelf: artistShelf(artist.slug) });
  return {
    artist: { id: artist.slug, name: artist.name, image: rows[0]?.thumbnail ?? null, track_count: rows.length },
    items: rows,
  };
}

export function listArtists() {
  return ARTISTS.map((ar) => {
    const rows = catalog({ shelf: artistShelf(ar.slug) });
    return { id: ar.slug, name: ar.name, image: rows[0]?.thumbnail ?? null, track_count: rows.length };
  }).filter((ar) => ar.track_count);
}

/**
 * The Artists grid leads with the voices Laxan opens with, and a name from her own library only
 * joins them when it carries more than one recording — a single song filed under "League of
 * Legends" is a mis-tagged download, not an artist she came to browse. A library name that
 * matches a curated one folds into it instead of appearing twice.
 */
export function artistsWithSaved(saved = []) {
  const out = listArtists();
  const seen = new Map(out.map((ar) => [sortKey(niceName(ar.name)), ar]));
  for (const row of saved) {
    const key = sortKey(niceName(row.name));
    const hit = seen.get(key);
    if (hit) {
      hit.track_count += row.track_count ?? 0;
      continue;
    }
    if ((row.track_count ?? 0) < 2) continue;
    seen.set(key, row);
    out.push(row);
  }
  return out;
}

/** Channel art is cached once per source so the grid still looks right on a plane. */
async function cacheArt(id, remote) {
  if (!remote) return null;
  const file = `covers/channel-${id}.jpg`;
  const absolute = path.join(LIBRARY_DIR, file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  if (existsSync(absolute)) return file;
  try {
    writeFileSync(absolute, await fetchBinary(remote));
    return file;
  } catch (err) {
    log.warn('source art skipped:', err.message);
    return null;
  }
}

export async function addChannel(input, kind = 'podcast') {
  const url = channelUrl(input);
  if (!url) throw new Error('That does not look like a YouTube channel. Give the channel link, like youtube.com/@name.');
  const existing = get('SELECT * FROM channels WHERE url = ?', url);
  if (existing) return row(existing);

  const id = newId();
  const name = nameFromUrl(url);
  run('INSERT INTO channels (id, url, name, sort_key, kind, image, added_at, uploads, fetched_at, shelf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', id, url, name, sortKey(name), kind, null, now(), null, null, null);
  await refreshChannel(id).catch((err) => log.warn(`${name} will list later:`, err.message));
  return row(channelById(id));
}

export async function refreshChannel(id) {
  const channel = channelById(id);
  if (!channel) throw new Error('Channel not found');
  if (pending.has(id)) return pending.get(id);

  const work = (async () => {
    const fetcher = DRIVERS[channel.driver];
    const info = fetcher ? await fetcher(channel.url, { limit: LIMIT, kind: channel.kind }) : await listUploads(channel.url, { limit: LIMIT });
    if (!info.entries.length) throw new Error(`Nothing came back from ${channel.name}.`);
    /* A saved search has no channel art of its own, so its top upload stands in for it. */
    const image = channel.url.startsWith('ytsearch') ? await cacheArt(id, info.entries[0]?.thumbnail) : await cacheArt(id, info.image);
    /* Recitation servers and feeds are named here because their own titles are a programme
       note, not what she looks for; a channel gets the name it publishes under. */
    const name = fetcher || channel.url.startsWith('ytsearch') ? channel.name : info.name || channel.name;
    run('UPDATE channels SET uploads = ?, fetched_at = ?, image = COALESCE(?, image), name = ?, sort_key = ?, fails = 0, failed_at = NULL, last_error = NULL, ok_at = ? WHERE id = ?', JSON.stringify(info.entries), now(), image, name, sortKey(name), now(), id);
    return channelUploads(id);
  })().catch((err) => {
    run('UPDATE channels SET fails = fails + 1, failed_at = ?, last_error = ? WHERE id = ?', now(), String(err?.message ?? err).slice(0, 200), id);
    throw err;
  }).finally(() => pending.delete(id));

  pending.set(id, work);
  return work;
}

/**
 * Runs `work` over `ids` with at most `size` of them in flight, so a slow source holds a lane
 * rather than the whole sweep. Failures are logged per source and do not stop the lane.
 */
async function pool(ids, size, work) {
  let at = 0;
  const lane = async () => {
    while (at < ids.length) {
      const id = ids[at++];
      await work(id).catch((err) => log.warn('source skipped:', err.message));
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, ids.length) }, lane));
}

/* The two engines cost different things. A feed or a recitation server is one HTTP request that
   answers in a second, so it can run twelve at a time and fill the shelves early; a scraped
   channel starts a Python process per source, so it waits its turn four at a time. They run
   beside each other, so the fast half of the catalog never queues behind the slow half. */
const FAST_LANES = 12;
const SLOW_LANES = 4;

/**
 * Opening the app should not wait on the whole catalogue, so the first call starts the sweep in
 * the background and every shelf read in the meantime comes back with ready:false. Only stale
 * sources are asked again, so a restart is not another ninety fetches.
 */
export function refreshAll() {
  if (warming) return warming;
  const due = dueSources();
  if (!due.length) return Promise.resolve();
  warming = (async () => {
    const fast = due.filter((c) => isLicensed(c.driver)).map((c) => c.id);
    const slow = due.filter((c) => !isLicensed(c.driver)).map((c) => c.id);
    await Promise.all([pool(fast, FAST_LANES, refreshChannel), pool(slow, SLOW_LANES, refreshChannel)]);
  })().finally(() => {
    warming = null;
  });
  return warming;
}

export function deleteChannel(id) {
  run('DELETE FROM channels WHERE id = ?', id);
  run('UPDATE tracks SET channel_id = NULL WHERE channel_id = ?', id);
}
