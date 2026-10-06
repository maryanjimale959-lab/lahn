/* A row whose audio belongs to its creator plays here, not out there: the video is the
   creator's own embed, but the player screen, the queue and the transport are Laxan's. Nothing
   is downloaded, converted or re-hosted — the listener never leaves the app. */

const API = 'https://www.youtube.com/iframe_api';

let ready = null;
let player = null;
/** The video asked for before the player finished being built. */
let wanted = null;
let ticker = null;
const watchers = new Set();

const say = (event) => {
  for (const fn of watchers) fn(event);
};

function loadApi() {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    if (window.YT?.Player) resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const tag = document.createElement('script');
    tag.src = API;
    document.head.append(tag);
  });
  return ready;
}

/** The video a row points at, or null when the row is ours to stream. */
export const videoOf = (track) => {
  if (!track || track.src) return null;
  const found = /(?:[?&]v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/.exec(track.link ?? '');
  return found ? found[1] : null;
};

export const watching = (fn) => {
  watchers.add(fn);
  return () => watchers.delete(fn);
};

function beat() {
  if (!player?.getCurrentTime) return;
  say({ type: 'time', time: player.getCurrentTime() || 0, duration: player.getDuration() || 0 });
}

/** Put the video surface on the page. React never renders inside it. */
export async function mount(el) {
  console.info('[dbg] mount start, wanted=', wanted);
  const inner = document.createElement('div');
  el.append(inner);
  const YT = await loadApi();
  console.info('[dbg] api ready, building player');
  player = new YT.Player(inner, {
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      iv_load_policy: 3,
      fs: 0,
      origin: window.location.origin,
    },
    events: {
      onReady: () => {
        if (wanted) player.loadVideoById(wanted);
        wanted = null;
      },
      onStateChange: (e) => {
        const state = e.data;
        clearInterval(ticker);
        if (state === 1) ticker = setInterval(beat, 500);
        beat();
        say({ type: 'state', playing: state === 1, ended: state === 0, buffering: state === 3 });
      },
      onError: () => say({ type: 'error' }),
    },
  });
}

export function play(videoId) {
  if (player?.loadVideoById) player.loadVideoById(videoId);
  else wanted = videoId;
}

export function pause() {
  player?.pauseVideo?.();
}

export function resume() {
  player?.playVideo?.();
}

export function halt() {
  clearInterval(ticker);
  player?.stopVideo?.();
}

export function seekTo(seconds) {
  player?.seekTo?.(seconds, true);
}

export function isPlaying() {
  return player?.getPlayerState?.() === 1;
}
