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

  add: (url) => request('POST', '/add', { url }),
  jobs: () => request('GET', '/jobs'),
  cancelJob: (id) => request('POST', `/jobs/${id}/cancel`),
  scan: () => request('POST', '/scan'),
};

export function watchJob(id, onMessage) {
  const source = new EventSource(`${BASE}/jobs/${id}/events`);
  source.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      onMessage({ status: 'error', message: 'Bad stream' });
    }
  };
  return () => source.close();
}

export const audioUrl = (id) => `${BASE}/tracks/${id}/audio`;
export const coverFor = (stored) => (stored ? `${BASE}/covers/${String(stored).split('/').pop()}` : null);
