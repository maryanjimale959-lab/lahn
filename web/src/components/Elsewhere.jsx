import { useEffect, useMemo, useState } from 'react';
import { clock } from '../lib/format.js';
import { Art } from './Art.jsx';
import { Icon } from './Icons.jsx';
import { useLibrary } from '../state/library.jsx';
import { usePlayer } from '../state/player.jsx';
import { useSession } from '../state/session.jsx';
import { useUi } from '../state/ui.jsx';

/* The driving screen beats every few seconds, so the mirror advances the readout
   between beats instead of freezing on the last one it heard. */
function useMirrorPosition(remote) {
  const [drift, setDrift] = useState(0);
  const beat = remote?.at;
  const isPlaying = remote?.playing;
  useEffect(() => {
    setDrift(0);
    if (!isPlaying) return undefined;
    const timer = setInterval(() => setDrift((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [beat, isPlaying]);
  return (remote?.position ?? 0) + drift;
}

/**
 * The other half of the app: another screen is playing, this one shows what and
 * hands it over with a single tap.
 */
export function Elsewhere({ onTakeOver }) {
  const { t } = useUi();
  const { remote } = useSession();
  const { tracks = [] } = useLibrary();
  const { takeover } = usePlayer();
  const position = useMirrorPosition(remote);

  const queue = useMemo(() => {
    if (!remote) return [];
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return remote.queueIds.map((id) => byId.get(id)).filter(Boolean);
  }, [remote, tracks]);

  if (!remote) return null;

  const device = t(remote.device?.kind === 'phone' ? 'session.phone' : 'session.pc');
  const track = queue.find((item) => item.id === remote.trackId) ?? null;
  const slot = track ? queue.indexOf(track) : 0;
  const duration = track?.duration || 0;
  const fill = duration ? Math.min(100, (position / duration) * 100) : 0;

  const take = () => {
    if (queue.length) takeover(queue, slot, position);
    onTakeOver?.();
  };

  return (
    <div
      className="elsewhere"
      role="button"
      tabIndex={0}
      aria-label={`${t('session.playingOn', { device })} — ${t('session.takeOver')}`}
      onClick={take}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          take();
        }
      }}
    >
      {track ? (
        <Art track={track} className="art" />
      ) : (
        <span className="elsewhere-blank">
          <Icon.disc />
        </span>
      )}
      <span className="elsewhere-meta">
        <b>
          <span className={`elsewhere-glyph ${remote.playing ? 'on' : ''}`}>
            {remote.device?.kind === 'phone' ? <Icon.phone /> : <Icon.laptop />}
          </span>
          {t('session.playingOn', { device })}
        </b>
        <span>{track ? `${track.title} · ${clock(duration || position)}` : t('session.notInLibrary')}</span>
      </span>
      <span className="pill-btn elsewhere-take">
        <Icon.play />
        {t('session.playHere')}
      </span>
      <span className="mini-fill" style={{ width: `${fill}%` }} />
    </div>
  );
}
