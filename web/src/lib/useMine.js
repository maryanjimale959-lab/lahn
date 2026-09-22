import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/** What this listener kept and what they were last hearing. */
export function useMine() {
  const [likes, setLikes] = useState([]);
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    api
      .mine()
      .then((res) => {
        setLikes(res?.likes ?? []);
        setHistory(res?.history ?? []);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(reload, [reload]);

  const liked = useCallback((key) => likes.includes(key), [likes]);

  const toggleLike = useCallback(
    (key) => {
      const on = !likes.includes(key);
      setLikes((prev) => (on ? [key, ...prev] : prev.filter((x) => x !== key)));
      api.like(key, on).catch(reload);
      return on;
    },
    [likes, reload]
  );

  return { likes, history, loaded, liked, toggleLike, reload };
}
