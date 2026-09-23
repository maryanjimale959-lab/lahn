/* A public Laxan gets knocked on by strangers, so the doors that hand out accounts and reset
   codes are counted here. Fixed windows held in memory: a personal app does not need a
   distributed store, and losing the counts at a restart only ever lets one more try through. */

const hits = new Map();

const sweep = (at) => {
  if (hits.size < 4096) return;
  for (const [id, rec] of hits) if (rec.reset <= at) hits.delete(id);
};

/**
 * @param bucket what is being guarded, e.g. 'signup'
 * @param key    who is asking, usually the client address
 * @param limit  { tries, windowMs }
 */
export function allow(bucket, key, { tries, windowMs }) {
  const at = Date.now();
  sweep(at);
  const id = `${bucket}|${key}`;
  const rec = hits.get(id);
  if (!rec || rec.reset <= at) {
    hits.set(id, { n: 1, reset: at + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  rec.n += 1;
  return { ok: rec.n <= tries, retryAfter: Math.ceil((rec.reset - at) / 1000) };
}

/** A limit that only observes, so a shared household behind one address is never blamed for it. */
export const peek = (bucket, key) => hits.get(`${bucket}|${key}`)?.n ?? 0;

export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'no-address';
}
