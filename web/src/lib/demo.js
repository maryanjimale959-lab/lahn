/* A hosted build has no server behind it, so this is one — in the browser. It reads the catalogue
   that `node scripts/demo.mjs` baked out of a throwaway Laxan and answers the same routes the real
   server does: shelves, sources, search, playback. Two kinds of row are in that file: one whose own
   source publishes the audio, which the browser fetches straight from them, and one that lives on
   its creator's page, which a tap hands back to that page. Nothing is fetched, converted, saved or
   downloaded on our behalf, because on a static page there is nobody here to do that work. */

const EMPTY = { items: [], rows: [], shelfPages: {}, kindPages: {}, channelPages: {}, sources: [], interests: [], version: '' };

const BY_KEY = new Map();
let table = null;

async function load() {
  if (table) return table;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}demo.json`);
    table = res.ok ? await res.json() : EMPTY;
  } catch {
    table = EMPTY;
  }
  if (!table?.items) table = EMPTY;
  for (const item of table.items) BY_KEY.set(item.key, item);
  return table;
}

/** Keys come back from the baked file; a key whose row was dropped simply disappears. */
const rows = (keys) => (keys ?? []).map((key) => BY_KEY.get(key)).filter(Boolean);

const ofShelf = (list, shelf) => list.filter((i) => i.shelf === shelf);
const ofKind = (list, kind) => list.filter((i) => i.kind === kind);

const find = (list, q) => {
  const needle = String(q ?? '').trim().toLowerCase();
  if (!needle) return [];
  return list.filter((i) => `${i.title} ${i.channel ?? ''}`.toLowerCase().includes(needle));
};

const newest = (list) => [...list].sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));

/* What a listener has tapped in this browser. The real Laxan keeps that on the server against her
   account; a preview has no accounts, so it keeps it where it is allowed to — on the device. */
const LOCAL = 'laxan-preview';
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) ?? '{}');
  } catch {
    return {};
  }
};
const write = (patch) => {
  try {
    localStorage.setItem(LOCAL, JSON.stringify({ ...read(), ...patch }));
  } catch {
    /* Private browsing: the row simply stays empty. */
  }
};

const offline = (code) => {
  const err = new Error(code);
  err.status = 400;
  err.code = code;
  throw err;
};

const missing = (route) => {
  const err = new Error(`Nothing at ${route}`);
  err.status = 404;
  return err;
};

/** The same contract `request()` keeps against a live server: data, or null for a missing GET. */
export async function answer(method, route, body) {
  const data = await load();
  const url = new URL(route, 'http://laxan');
  const path = url.pathname.replace(/\/$/, '') || '/';
  const query = url.searchParams;
  const get = method === 'GET';

  if (get && path === '/health') {
    return {
      ok: true,
      version: data.version,
      name: 'Laxan',
      licensedOnly: true,
      mail: false,
      sources: { total: data.sources.length, failing: 0, dead: 0, due: 0 },
      stats: { tracks: 0, items: data.items.length },
    };
  }

  /* Nobody signs up here: a preview opens the same way Laxan opens on her own Wi-Fi before the
     first account exists. */
  if (get && path === '/me') return { user: null, accounts: 0 };
  if (get && path === '/interests') return { interests: data.interests };
  if (get && path === '/mine') {
    const kept = read();
    return { likes: kept.likes ?? [], history: kept.history ?? [] };
  }
  if (path === '/mine/played' && !get) {
    const key = String(body?.key ?? '');
    if (!BY_KEY.has(key)) return { ok: false };
    const item = BY_KEY.get(key);
    const kept = read();
    const history = [{ item_key: key, title: item.title, channel: item.channel, thumbnail: item.thumbnail, duration: item.duration, kind: item.kind }, ...(kept.history ?? []).filter((h) => h.item_key !== key)].slice(0, 40);
    write({ ...kept, history });
    return { ok: true };
  }
  if (path === '/mine/like' && !get) {
    const kept = read();
    const likes = (kept.likes ?? []).filter((k) => k !== body?.key);
    if (body?.on) likes.unshift(body.key);
    write({ ...kept, likes });
    return { likes };
  }

  if (get && path === '/shelves') {
    return {
      shelves: data.rows.map((row) => ({ id: row.id, items: rows(row.keys) })),
      picked: [],
      ready: true,
      total: data.items.length,
    };
  }

  if (get && path === '/catalog') {
    const shelf = query.get('shelf');
    const kind = query.get('kind');
    const q = query.get('q');
    const items = shelf ? rows(data.shelfPages[shelf] ?? data.rows.find((r) => r.id === shelf)?.keys) : kind ? rows(data.kindPages[kind]) : q ? find(data.items, q) : newest(data.items);
    return { items, ready: true };
  }

  if (get && path === '/search') {
    const q = query.get('q') ?? '';
    return { query: q, tracks: [], artists: [], albums: [], playlists: [], catalog: find(data.items, q).slice(0, 40) };
  }

  if (get && path === '/channels') {
    return { channels: data.sources.map((c) => ({ ...c, licensed: true, isSearch: false, fails: 0, health: 'ok' })) };
  }
  if (get && path.startsWith('/channels/')) {
    const id = decodeURIComponent(path.slice('/channels/'.length));
    const source = data.sources.find((c) => c.id === id);
    if (!source) throw missing(route);
    return {
      channel: { ...source, licensed: true },
      uploads: rows(data.channelPages[id]).map((i) => ({ id: i.id, title: i.title, audio: i.audio, link: i.link ?? null, duration: i.duration, thumbnail: i.thumbnail, uploadedAt: i.uploadedAt, savedTrackId: null })),
      /* "fresh" is what stops the real page from asking its source again on sight. Here nobody
         can: the list is the one that was baked. */
      fresh: true,
      tracks: [],
    };
  }

  if (get && path === '/library') {
    return {
      stats: { tracks: 0, items: data.items.length },
      recent: [],
      popular: [],
      artists: [],
      albums: [],
      podcasts: [],
      lessons: [],
      spoken: [],
      playlists: [],
      tracks: [],
      channels: data.sources.map((c) => ({ ...c, licensed: true, isSearch: false, fails: 0, health: 'ok' })),
    };
  }

  /* The shelves hold no songs, so the library's own rooms are empty rather than absent. */
  if (get && path === '/artists') return { artists: [] };
  if (get && path === '/albums') return { albums: [] };
  if (get && path === '/playlists') return { playlists: [] };
  if (get && path === '/tracks') return { tracks: [] };
  if (get && path === '/jobs') return { jobs: [] };
  if (get && path === '/session') return { session: null };
  if (path === '/session' && !get) return { session: body?.session ?? null };

  if (get) throw missing(route);
  /* Follow a source, save a file, make an account — all of them need the machine this preview
     does not have. The screens hide the buttons; this is the door behind them. */
  return offline('preview-off');
}

/** A shelf item's own file link — the reason a tap starts at once with nobody between. */
export const mediaFor = (key) => BY_KEY.get(String(key))?.audio ?? null;
