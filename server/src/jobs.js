import { all, newId, now, run } from './db.js';
import { ingest } from './library.js';
import { log } from './log.js';

const jobs = new Map();
const MAX_HISTORY = 60;

function snapshot(job) {
  return {
    id: job.id,
    url: job.url,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    percent: job.percent,
    message: job.message,
    meta: job.meta ?? null,
    track: job.track ?? null,
    error: job.error ?? null,
    createdAt: job.createdAt,
  };
}

function push(job) {
  const body = `data: ${JSON.stringify(snapshot(job))}\n\n`;
  for (const res of job.listeners) {
    try {
      res.write(body);
    } catch {
      job.listeners.delete(res);
    }
  }
}

function persist(job) {
  run(
    `INSERT INTO jobs (id, url, status, stage, percent, message, title, artist, track_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status, stage = excluded.stage, percent = excluded.percent,
       message = excluded.message, title = excluded.title, artist = excluded.artist,
       track_id = excluded.track_id, updated_at = excluded.updated_at`,
    job.id,
    job.url,
    job.status,
    job.stage,
    job.percent,
    job.message,
    job.meta?.title ?? null,
    job.meta?.artist ?? null,
    job.track?.id ?? null,
    job.createdAt,
    now()
  );
  run(
    `DELETE FROM jobs WHERE id NOT IN (
       SELECT id FROM jobs ORDER BY created_at DESC LIMIT ?
     )`,
    MAX_HISTORY
  );
}

function update(job, patch) {
  Object.assign(job, patch);
  job.updatedAt = now();
  persist(job);
  push(job);
}

export function createJob(url, { kind = 'song', channelId = null } = {}) {
  const job = {
    id: newId(),
    url,
    kind,
    channelId,
    status: 'queued',
    stage: 'queued',
    percent: 0,
    message: 'Waiting…',
    meta: null,
    track: null,
    error: null,
    createdAt: now(),
    listeners: new Set(),
    controller: new AbortController(),
  };
  jobs.set(job.id, job);
  persist(job);

  (async () => {
    try {
      update(job, { status: 'running' });
      const track = await ingest(url, { kind: job.kind, channelId: job.channelId, onStage: (patch) => update(job, patch) }, job.controller.signal);
      update(job, { status: 'done', stage: 'done', percent: 100, track, message: 'Added to your library' });
      log.ok(`added “${track.title}” — ${track.artist}`);
    } catch (err) {
      const cancelled = err.code === 'CANCELLED' || job.controller.signal.aborted;
      update(job, {
        status: cancelled ? 'cancelled' : 'error',
        stage: cancelled ? 'cancelled' : 'failed',
        error: err.message,
        message: cancelled ? 'Cancelled' : err.message,
      });
      if (!cancelled) log.error(`download failed: ${err.message}`);
    } finally {
      job.controller = null;
    }
  })();

  return job;
}

export function getJob(id) {
  return jobs.get(id) ?? null;
}

/**
 * A restart kills the yt-dlp children, so any job still marked running in the
 * database is a phantom the UI would wait on forever.
 */
export function failInterruptedJobs() {
  const rows = all("SELECT id FROM jobs WHERE status IN ('queued','running')");
  for (const row of rows) {
    run('UPDATE jobs SET status = ?, stage = ?, message = ?, updated_at = ? WHERE id = ?', 'error', 'failed', 'Laxan was closed while this was downloading. Paste the link again.', now(), row.id);
  }
  return rows.length;
}

export function listJobs() {
  const out = [];
  const seen = new Set();
  for (const row of recentFromDb()) {
    seen.add(row.id);
    out.push(jobs.get(row.id) ? snapshot(jobs.get(row.id)) : fromRow(row));
  }
  for (const job of jobs.values()) {
    if (!seen.has(job.id)) out.push(snapshot(job));
  }
  return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
}

function recentFromDb() {
  return all('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 20');
}

function fromRow(row) {
  return {
    id: row.id,
    url: row.url,
    status: row.status,
    stage: row.stage,
    percent: row.percent,
    message: row.message,
    meta: row.title ? { title: row.title, artist: row.artist } : null,
    track: row.track_id ? { id: row.track_id } : null,
    error: null,
    createdAt: row.created_at,
  };
}

export function subscribe(id, res) {
  const job = jobs.get(id);
  if (!job) return false;
  job.listeners.add(res);
  res.write(`data: ${JSON.stringify(snapshot(job))}\n\n`);
  return true;
}

export function unsubscribe(id, res) {
  jobs.get(id)?.listeners.delete(res);
}

export function cancel(id) {
  const job = jobs.get(id);
  if (!job) return false;
  job.controller?.abort();
  return true;
}

export function isDuplicateUrl(url) {
  return [...jobs.values()].some((j) => j.url === url && (j.status === 'queued' || j.status === 'running'));
}
