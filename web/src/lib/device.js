const KEY = 'lahn.device';

const isPhone = () => /android|iphone|ipod|ipad|mobile/i.test(navigator.userAgent);

/**
 * A stable per-browser identity so the house knows which screen is driving
 * playback. Two tabs on one machine count as two screens, which is what you
 * would expect when you open Laxan twice.
 */
export function thisDevice() {
  const kind = isPhone() ? 'phone' : 'desktop';
  const label = kind === 'phone' ? 'Phone' : 'PC';
  let id = '';
  try {
    id = localStorage.getItem(KEY) ?? '';
  } catch {
    /* Private mode: an id that lives only for this tab is still enough. */
  }
  if (!id) {
    id = `${kind.slice(0, 3)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  }
  return { id, kind, name: label };
}
