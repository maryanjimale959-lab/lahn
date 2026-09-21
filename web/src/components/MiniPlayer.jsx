import { clock } from '../lib/format.js';
import { Art } from './Art.jsx';
import { Icon } from './Icons.jsx';
import { usePlayer } from '../state/player.jsx';
import { useUi } from '../state/ui.jsx';

export function MiniPlayer({ onOpen }) {
  const { t } = useUi();
  const { current, playing, time, duration, toggle, next } = usePlayer();
  if (!current) return null;

  const fill = duration ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div className="mini" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}>
      <Art track={current} className="art" />
      <span className="mini-meta">
        <b>{current.title}</b>
        <span>
          {current.artist} · {clock(duration || current.duration)}
        </span>
      </span>
      <button
        type="button"
        className="t-btn"
        aria-label={playing ? t('player.pause') : t('player.play')}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        {playing ? <Icon.pause /> : <Icon.play />}
      </button>
      <button
        type="button"
        className="t-btn next-peek"
        aria-label={t('player.next')}
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
      >
        <Icon.next />
      </button>
      <span className="mini-fill" style={{ width: `${fill}%` }} />
    </div>
  );
}
