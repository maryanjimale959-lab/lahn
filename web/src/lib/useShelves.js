import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const POLL_MS = 12000;
const MAX_POLLS = 14;

/**
 * The first read of a cold catalog kicks off a server-wide sweep, so the shelves come back
 * `ready: false` and keep being re-read until every source has answered.
 */
export function useShelves() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const runs = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await api.shelves();
      setData(res);
      setError(null);
      return res;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    runs.current = 0;
    (async () => {
      let res = await load();
      while (alive && res && !res.ready && runs.current < MAX_POLLS) {
        await new Promise((done) => setTimeout(done, POLL_MS));
        if (!alive) return;
        runs.current += 1;
        res = await load();
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  return { shelves: data?.shelves ?? [], ready: data?.ready ?? false, total: data?.total ?? 0, loaded: !!data, error, reload: load };
}
