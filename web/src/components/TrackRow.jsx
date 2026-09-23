import { clock } from '../lib/format.js';
import { Icon } from './Icons.jsx';
import { Art } from './Art.jsx';
import { AddToPlaylist } from './AddToPlaylist.jsx';
import { api } from '../lib/api.js';
import { handsOff } from '../lib/external.js';
import { useUi } from '../state/ui.jsx';
import { useLibrary } from '../state/library.jsx';
import { usePlayer } from '../state/player.jsx';

export function TrackRow({ track, index, list, onRemove, showAlbum = true, showArtist = true }) {
  const { t } = useUi();
  const { refresh } = useLibrary();
  const { current, playing, playTrack } = usePlayer();
  const isCurrent = current?.id === track.id;

  const toggleFavourite = async (event) => {
    event.stopPropagation();
    await api.favourite(track.id, !track.favourite);
    refresh().catch(() => {});
  };

  return (
    <div
      className={`track ${isCurrent ? 'current' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => playTrack(track, list)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playTrack(track, list);
        }
      }}
    >
      <span className="idx" aria-hidden="true">
        {isCurrent && playing ? (
          <span className="bars">
            <i />
            <i />
            <i />
          </span>
        ) : (
          index + 1
        )}
      </span>

      <Art track={track} className="thumb" />

      <span className="meta">
        <b>
          {track.title}
          {handsOff(track) && (
            <span className="go-channel" title={t('common.onChannel')}>
              <Icon.link />
            </span>
          )}
        </b>
        <span>
          {[showArtist && track.artist, showAlbum && track.album !== 'Singles' && track.album]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>

      <span className="acts" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          title={t('player.favourite')}
          aria-label={t('player.favourite')}
          className={track.favourite ? 'fav on' : 'fav'}
          onClick={toggleFavourite}
        >
          {track.favourite ? <Icon.heartOn /> : <Icon.heart />}
        </button>
        <AddToPlaylist trackIds={[track.id]} className="row-menu row-add">
          <Icon.plus />
        </AddToPlaylist>
        {onRemove && (
          <button type="button" title={t('playlists.remove')} aria-label={t('playlists.remove')} onClick={onRemove}>
            <Icon.close />
          </button>
        )}
      </span>

      <span className="dur">{clock(track.duration)}</span>
    </div>
  );
}
