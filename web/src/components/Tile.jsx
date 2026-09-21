import { Icon } from './Icons.jsx';
import { Art } from './Art.jsx';
import { usePlayer } from '../state/player.jsx';
import { useUi } from '../state/ui.jsx';

export function Tile({ to, title, subtitle, track, tracks, cover, round }) {
  const { playList } = usePlayer();
  const { t } = useUi();
  const label = title ?? track?.title ?? '';
  const list = tracks ?? (track ? [track] : null);

  return (
    <a className="tile" href={to}>
      <Art track={track} cover={cover} name={label} className={round ? 'round' : ''} />
      <h3>{label}</h3>
      <p>{subtitle ?? track?.artist ?? ''}</p>
      {list && (
        <span
          className="play-fab"
          role="button"
          tabIndex={-1}
          aria-label={t('detail.play')}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            playList(list, 0);
          }}
        >
          <Icon.play />
        </span>
      )}
    </a>
  );
}

export function Section({ title, more, children }) {
  const { t } = useUi();
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {more && (
          <a href={more}>
            {t('common.seeAll')}
          </a>
        )}
      </div>
      {children}
    </section>
  );
}
