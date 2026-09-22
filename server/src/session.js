/* One now-playing session for the whole house: the device that last pressed
   something drives it, every other screen mirrors it until it takes over. */

const STALE_MS = 15000;
const MAX_QUEUE = 200;
const REPEATS = new Set(['off', 'all', 'one']);

const ID = /^[\w.-]{1,40}$/;

const text = (value, max) => String(value ?? '').trim().slice(0, max);

function cleanDevice(device) {
  const id = text(device?.id, 40);
  if (!ID.test(id)) return null;
  return { id, name: text(device?.name, 40) || 'Device', kind: device?.kind === 'phone' ? 'phone' : 'desktop' };
}

let session = { device: null, trackId: null, queueIds: [], slot: 0, position: 0, playing: false, shuffle: false, repeat: 'off', at: 0, rev: 0 };
const listeners = new Set();

/** Position is extrapolated between beats so a mirrored progress bar keeps moving.
    A driver that has missed three beats has been closed, so the session is nobody's. */
export function current() {
  const elapsed = (Date.now() - session.at) / 1000;
  const alive = Date.now() - session.at < STALE_MS;
  const playing = session.playing && alive;
  return {
    ...session,
    device: alive ? session.device : null,
    trackId: alive ? session.trackId : null,
    playing,
    position: Math.round((session.position + (playing ? elapsed : 0)) * 10) / 10,
    at: Date.now(),
  };
}

export function claim(input, device) {
  const owner = cleanDevice(device);
  if (!owner) return null;
  const queueIds = Array.isArray(input?.queueIds) ? input.queueIds.map((id) => text(id, 40)).filter((id) => ID.test(id)).slice(0, MAX_QUEUE) : [];
  const trackId = text(input?.trackId, 40);
  session = {
    device: owner,
    trackId: ID.test(trackId) ? trackId : null,
    queueIds,
    slot: Math.max(0, Math.min(Number(input?.slot) || 0, queueIds.length - 1 || 0)),
    position: Math.max(0, Number(input?.position) || 0),
    playing: Boolean(input?.playing),
    shuffle: Boolean(input?.shuffle),
    repeat: REPEATS.has(input?.repeat) ? input.repeat : 'off',
    at: Date.now(),
    rev: session.rev + 1,
  };
  broadcast();
  return current();
}

function broadcast() {
  const body = `data: ${JSON.stringify(current())}\n\n`;
  for (const res of listeners) {
    try {
      res.write(body);
    } catch {
      listeners.delete(res);
    }
  }
}

export function subscribe(res) {
  listeners.add(res);
  res.write(`data: ${JSON.stringify(current())}\n\n`);
}

export function unsubscribe(res) {
  listeners.delete(res);
}
