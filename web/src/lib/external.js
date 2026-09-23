/* Some rows have no file for Laxan to play: the song, its artwork and its listen all belong to
   the creator's own page. Tapping one hands the listener over there, so the view is counted for
   the person who made it instead of being copied onto our host. */
export const handsOff = (track) => Boolean(track?.link) && !track?.src;

export function openChannel(track) {
  window.open(track.link, '_blank', 'noopener');
}
