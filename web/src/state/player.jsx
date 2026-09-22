import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, audioUrl, coverFor } from '../lib/api.js';
import { useSession } from './session.jsx';
import { useUi } from './ui.jsx';

export const PlayerContext = createContext(null);

/* How often the driver tells the other screens where it got to. */
const BEAT_MS = 5000;

const shuffled = (length, keepFirst) => {
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== keepFirst);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [keepFirst, ...rest];
};

export function PlayerProvider({ children }) {
  const { t } = useUi();
  const [audio] = useState(() => {
    const el = new Audio();
    el.preload = 'metadata';
    return el;
  });

  const [queue, setQueue] = useState([]);
  const [order, setOrder] = useState([]);
  const [slot, setSlot] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const stateRef = useRef({});
  stateRef.current = { queue, order, slot, repeat, shuffle };

  const { remote, publish } = useSession();
  const remoteRef = useRef(null);
  remoteRef.current = remote;

  /* "Play here" flips this so the hand-off can publish while the remote snapshot it is
     still mirroring has not cleared yet. It also holds off the pause-the-mirror effect. */
  const takingOver = useRef(false);
  const pendingSeek = useRef(0);

  const current = queue[order[slot] ?? slot] ?? queue[slot] ?? null;
  const currentRef = useRef(null);
  currentRef.current = current;

  /** What the other screens need to mirror this one. */
  const snapshot = useCallback(() => {
    const { queue: q2, order: o2, slot: s, repeat: r, shuffle: sh } = stateRef.current;
    const list = o2.length ? o2.map((i) => q2[i]) : q2;
    return {
      trackId: list[s]?.id ?? null,
      queueIds: list.map((t) => t.id),
      slot: s,
      position: audio.currentTime || 0,
      playing: !audio.paused,
      shuffle: sh,
      repeat: r,
    };
  }, [audio]);

  /* Only the device that owns the session may write it, or a mirrored screen
     pausing itself would immediately steal playback back. */
  const beat = useCallback(() => {
    if (!currentRef.current) return;
    if (remoteRef.current && !takingOver.current) return;
    takingOver.current = false;
    publish(snapshot());
  }, [publish, snapshot]);

  /* React state is still the previous render's inside an event handler, so the loader
     takes the resolved list instead of reading stateRef — playList() would otherwise
     see an empty queue and never touch the audio element. */
  const loadAt = useCallback(
    (list, nextSlot, autoplay = true) => {
      const bounded = Math.max(0, Math.min(nextSlot, list.length - 1));
      setSlot(bounded);
      setTime(0);
      setError(null);
      const track = list[bounded];
      if (!track) return;
      setLoading(true);
      /* A saved track plays from the library; a shelf item carries its own stream
         address and the server fetches it on demand, so nothing is stored. */
      audio.src = track.src ?? audioUrl(track.id);
      if (autoplay) {
        audio.play().catch((err) => {
          if (err.name !== 'AbortError') setError(err.message);
          setLoading(false);
        });
      }
      if (track.src) api.heard(track.id).catch(() => {});
      else api.played(track.id).catch(() => {});
    },
    [audio]
  );

  const goTo = useCallback(
    (nextSlot, autoplay = true) => {
      const { queue: q2, order: o2 } = stateRef.current;
      loadAt(o2.length ? o2.map((i) => q2[i]) : q2, nextSlot, autoplay);
    },
    [loadAt]
  );

  const playList = useCallback(
    (tracks, startIndex = 0) => {
      if (!tracks?.length) return;
      const list = tracks.filter(Boolean);
      const o = shuffle ? shuffled(list.length, startIndex) : list.map((_, i) => i);
      /* A tap on this screen is an order: it takes the session from whatever else is
         playing, rather than starting a second copy the house then mutes. */
      takingOver.current = true;
      pendingSeek.current = 0;
      setQueue(list);
      setOrder(o);
      loadAt(o.map((i) => list[i]), 0, true);
    },
    [loadAt, shuffle]
  );

  const playTrack = useCallback(
    (track, contextList) => {
      const list = contextList?.length ? contextList : [track];
      const index = Math.max(0, list.findIndex((t) => t.id === track.id));
      const tail = [...list.slice(index), ...list.slice(0, index)];
      playList(tail, 0);
    },
    [playList]
  );

  const toggle = useCallback(() => {
    if (!currentRef.current) return;
    if (audio.paused) audio.play().catch((err) => setError(err.message));
    else audio.pause();
  }, [audio]);

  const next = useCallback(() => {
    const { queue: q2, order: o2 } = stateRef.current;
    const length = (o2.length ? o2 : q2).length;
    if (!length) return;
    const { slot: s, repeat: r } = stateRef.current;
    if (s + 1 >= length) {
      if (r === 'all') goTo(0);
      else setPlaying(false);
      return;
    }
    goTo(s + 1);
  }, [goTo]);

  const prev = useCallback(() => {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const { slot: s } = stateRef.current;
    if (s <= 0) {
      audio.currentTime = 0;
      return;
    }
    goTo(s - 1);
  }, [audio, goTo]);

  const seek = useCallback(
    (seconds) => {
      audio.currentTime = seconds;
      setTime(seconds);
      beat();
    },
    [audio, beat]
  );

  const setShuffle = useCallback((on) => {
    const { queue: q2, order: o2, slot: s } = stateRef.current;
    const list = o2.length ? o2 : q2.map((_, i) => i);
    const currentIdx = list[s] ?? 0;
    setShuffleState(on);
    setOrder(on ? shuffled(q2.length, currentIdx) : q2.map((_, i) => i));
    setSlot(on ? 0 : currentIdx);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));
  }, []);

  const stop = useCallback(() => {
    audio.pause();
    audio.removeAttribute('src');
    pendingSeek.current = 0;
    takingOver.current = false;
    setQueue([]);
    setOrder([]);
    setSlot(0);
    setPlaying(false);
    /* Say so out loud, or the other screens keep mirroring a track that is gone. */
    if (!remoteRef.current) publish({ trackId: null, queueIds: [], slot: 0, position: 0, playing: false });
  }, [audio, publish]);

  /** Claim the shared session and carry on with the other screen's queue here. */
  const takeover = useCallback(
    (tracks, startIndex = 0, position = 0) => {
      if (!tracks?.length) return;
      const from = Math.max(0, Math.min(startIndex, tracks.length - 1));
      playList([...tracks.slice(from), ...tracks.slice(0, from)], 0);
      pendingSeek.current = position;
    },
    [playList]
  );

  useEffect(() => {
    /* A hand-off resumes where the other screen left off, but the element will not take
       a seek until the stream says that far is reachable — so keep trying until it is. */
    const applySeek = () => {
      const target = pendingSeek.current;
      if (!target || audio.readyState < 1) return;
      const seekable = audio.seekable;
      if (!seekable.length || target > seekable.end(seekable.length - 1) - 0.25) return;
      audio.currentTime = target;
      setTime(target);
      pendingSeek.current = 0;
    };
    const onTime = () => {
      setTime(audio.currentTime);
      applySeek();
    };
    const onMeta = () => {
      setDuration(audio.duration || 0);
      setLoading(false);
      applySeek();
    };
    const onPlay = () => {
      setPlaying(true);
      setLoading(false);
    };
    const onPause = () => setPlaying(false);
    const onError = () => {
      setLoading(false);
      if (audio.src) setError(t('player.playFailed'));
    };
    const onEnded = () => {
      const { repeat: r } = stateRef.current;
      if (r === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      next();
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('canplay', applySeek);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('canplay', applySeek);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audio, next, t]);

  /* The driver announces every transport change, and keeps beating while a track is
     loaded — a screen that stops beating has been closed, and the house drops it. */
  useEffect(() => {
    beat();
  }, [beat, current, playing, shuffle, repeat]);

  useEffect(() => {
    if (!current) return undefined;
    const timer = setInterval(beat, BEAT_MS);
    return () => clearInterval(timer);
  }, [beat, current]);

  /* Playback moving to another screen means this one has to go quiet rather than run a
     second copy of the same track. */
  useEffect(() => {
    if (remote && !takingOver.current && !audio.paused) audio.pause();
  }, [audio, remote]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!current) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const cover = coverFor(current.cover);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist ?? '',
      album: current.album ?? '',
      artwork: cover ? [{ src: cover, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
    navigator.mediaSession.setActionHandler('play', () => audio.play().catch(() => {}));
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', prev);
    navigator.mediaSession.setActionHandler('nexttrack', next);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seek(details.seekTime);
    });
  }, [audio, current, next, prev, seek]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest('input, textarea, select, [contenteditable]')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        toggle();
      } else if (event.code === 'ArrowRight' && event.shiftKey) next();
      else if (event.code === 'ArrowLeft' && event.shiftKey) prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, toggle]);

  const upNext = useMemo(() => {
    const list = order.length ? order.map((i) => queue[i]) : queue;
    return list.slice(slot + 1, slot + 8);
  }, [order, queue, slot]);

  const value = useMemo(
    () => ({
      current,
      queue,
      slot,
      count: (order.length ? order : queue).length,
      playing,
      loading,
      time,
      duration: duration || current?.duration || 0,
      shuffle,
      repeat,
      error,
      upNext,
      playList,
      playTrack,
      takeover,
      toggle,
      next,
      prev,
      seek,
      setShuffle,
      cycleRepeat,
      goTo,
      stop,
    }),
    [current, queue, slot, order, playing, loading, time, duration, shuffle, repeat, error, upNext, playList, playTrack, takeover, toggle, next, prev, seek, setShuffle, cycleRepeat, goTo, stop]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  return useContext(PlayerContext);
}
