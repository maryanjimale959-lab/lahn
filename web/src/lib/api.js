const BASE = '/api';

async function request(method, route, body) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === 'GET') return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) throw new Error(data?.error || `${method} ${route} failed (${res.status})`);
  return data;
}

const q = (params) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
  const str = search.toString();
  return str ? `?${str}` : '';
};

export const api = {
  health: () => request('GET', '/health'),
  library: () => request('GET', '/library'),
  tracks: (params = {}) => request('GET', `/tracks${q(params)}`),
  artists: () => request('GET', '/artists'),
  artist: (id) => request('GET', `/artists/${id}`),
  albums: () => request('GET', '/albums'),
  album: (id) => request('GET', `/albums/${id}`),
  search: (query) => request('GET', `/search${q({ q: query })}`),

  playlists: () => request('GET', '/playlists'),
  playlist: (id) => request('GET', `/playlists/${id}`),
  createPlaylist: (name, description) => request('POST', '/playlists', { name, description }),
  renamePlaylist: (id, patch) => request('PATCH', `/playlists/${id}`, patch),
  deletePlaylist: (id) => request('DELETE', `/playlists/${id}`),
  addToPlaylist: (id, trackIds) => request('POST', `/playlists/${id}/items`, { trackIds }),
  removeFromPlaylist: (id, trackId) => request('DELETE', `/playlists/${id}/items/${trackId}`),
  reorderPlaylist: (id, trackIds) => request('PUT', `/playlists/${id}/items`, { trackIds }),

  track: (id) => request('GET', `/tracks/${id}`),
  deleteTrack: (id) => request('DELETE', `/tracks/${id}`),
  favourite: (id, value) => request('POST', `/tracks/${id}/favourite`, { favourite: value }),
  played: (id) => request('POST', `/tracks/${id}/play`),

  add: (url, options = {}) => request('POST', '/add', { url, ...options }),
  jobs: () => request('GET', '/jobs'),
  cancelJob: (id) => request('POST', `/jobs/${id}/cancel`),
  scan: () => request('POST', '/scan'),

  channels: () => request('GET', '/channels'),
  channel: (id) => request('GET', `/channels/${id}`),
  addChannel: (url, kind) => request('POST', '/channels', { url, kind }),
  refreshChannel: (id) => request('POST', `/channels/${id}/refresh`),
  deleteChannel: (id) => request('DELETE', `/channels/${id}`),
  refreshChannels: () => request('POST', '/channels/refresh-all'),

  shelves: () => request('GET', '/shelves'),
  catalog: (params = {}) => request('GET', `/catalog${q(params)}`),

  session: () => request('GET', '/session'),
  saveSession: (device, session) => request('PUT', '/session', { device, session }),
};

function openStream(route, onMessage) {
  const source = new EventSource(`${BASE}${route}`);
  source.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      onMessage({ status: 'error', message: 'Bad stream' });
    }
  };
  return () => source.close();
}

export const watchJob = (id, onMessage) => openStream(`/jobs/${id}/events`, onMessage);
export const watchSession = (onMessage) => openStream('/session/events', onMessage);

export const audioUrl = (id) => `${BASE}/tracks/${id}/audio`;

/* Covers are stored as "covers/<id>.jpg" in the library, but a channel or shelf can
   hand back a remote poster. Only the stored form needs the API prefix. */
export const coverFor = (stored) => {
  const value = String(stored ?? '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${BASE}/covers/${value.split('/').pop()}`;
};
