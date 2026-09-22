import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, watchJob } from '../lib/api.js';

export const LibraryContext = createContext(null);

export function LibraryProvider({ children }) {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [jobs, setJobs] = useState({});
  const [offline, setOffline] = useState(false);
  const watchers = useRef(new Map());

  const refresh = useCallback(async () => {
    try {
      const [library, status] = await Promise.all([api.library(), api.health()]);
      setData(library);
      setHealth(status);
      setOffline(false);
      return library;
    } catch (err) {
      setOffline(true);
      throw err;
    }
  }, []);

  const track = useCallback((job) => {
    setJobs((prev) => ({ ...prev, [job.id]: job }));
    if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') {
      watchers.current.get(job.id)?.();
      watchers.current.delete(job.id);
      if (job.status === 'done') refresh().catch(() => {});
    }
  }, [refresh]);

  const follow = useCallback(
    (id) => {
      if (watchers.current.has(id)) return;
      watchers.current.set(id, watchJob(id, track));
    },
    [track]
  );

  const save = useCallback(
    async (url, options = {}) => {
      const link = url.trim();
      const { jobId } = await api.add(link, options);
      follow(jobId);
      setJobs((prev) => ({ ...prev, [jobId]: { id: jobId, url: link, kind: options.kind ?? 'song', status: 'queued', stage: 'queued', percent: 0, message: 'Waiting…' } }));
      return jobId;
    },
    [follow]
  );

  useEffect(() => {
    refresh().catch(() => {});
    api
      .jobs()
      .then(({ jobs: history }) => {
        const map = {};
        for (const job of history) {
          map[job.id] = job;
          if (job.status === 'queued' || job.status === 'running') follow(job.id);
        }
        setJobs((prev) => ({ ...map, ...prev }));
      })
      .catch(() => {});
    const watchersMap = watchers.current;
    return () => {
      for (const close of watchersMap.values()) close();
      watchersMap.clear();
    };
  }, [follow, refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh().catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  const cancel = useCallback(async (id) => {
    await api.cancelJob(id);
  }, []);

  const value = useMemo(
    () => ({
      ...data,
      health,
      offline,
      jobs,
      refresh,
      save,
      cancel,
    }),
    [data, health, offline, jobs, refresh, save, cancel]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  return useContext(LibraryContext);
}
