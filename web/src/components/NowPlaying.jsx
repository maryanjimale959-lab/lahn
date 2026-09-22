import { useEffect, useState } from 'react';
import { api, coverFor } from '../lib/api.js';
import { clock } from '../lib/format.js';
import { AddToPlaylist } from './AddToPlaylist.jsx';
import { Icon } from './Icons.jsx';
import { Vinyl } from './Vinyl.jsx';
import { useLibrary } from '../state/library.jsx';
import { usePlayer } from '../state/player.jsx';
import { useUi } from '../state/ui.jsx';

export function NowPlaying({ onClose }) {
  const { t, lang } = useUi();
  const { refresh } = useLibrary();
  const { current, playing, loading, time, duration, shuffle, repeat, upNext, slot, error, toggle, next, prev, seek, setShuffle, cycleRepeat, goTo } = usePlayer();
  const [scrub, setScrub] = useState(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [fav, setFav] = useState(Boolean(current?.favourite));

  useEffect(() => setFav(Boolean(current?.favourite)), [current?.id, current?.favourite]);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const shown = scrub ?? time;
  const fill = duration ? Math.min(100, (shown / duration) * 100) : 0;
  const cover = coverFor(current?.cover);

  const flipFavourite = async () => {
    if (!current) return;
    const nextVal = !fav;
    setFav(nextVal);
    await api.favourite(current.id, nextVal);
    refresh().catch(() => {});
  };

  return (
    <section className={`now ${queueOpen ? 'with-queue' : ''}`} aria-label={t('player.nowPlaying')}>
      <div className="now-bg" style={{ backgroundImage: cover ? `url(${cover})` : 'none' }} />

      <header className="now-bar">
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.ok')}>
          <Icon.down />
        </button>
        <span className="spacer" />
        <span className="crumb">{t('player.nowPlaying')}</span>
        <span className="spacer" />
        <button type="button" className={`icon-btn ${queueOpen ? 'on' : ''}`} onClick={() => setQueueOpen((v) => !v)} aria-label={t('player.queue')}>
          <Icon.queue />
        </button>
      </header>

      <div className="now-stage">
        <Vinyl track={current} playing={playing} loading={loading} progress={duration ? time / duration : 0} />

        <div className="right">
          <div className="now-text">
            <h2>{current?.title ?? t('player.noTrack')}</h2>
            <p>
              <span>{current?.artist}</span>
              {current?.album && current.album !== 'Singles' ? (
                <>
                  <em>{t('player.from')}</em>
                  <span>{current.album}</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="seek">
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={shown}
              style={{ '--fill': `${fill}%` }}
              onChange={(e) => setScrub(Number(e.target.value))}
              onPointerUp={(e) => {
                seek(Number(e.target.value));
                setScrub(null);
              }}
              onKeyUp={(e) => {
                seek(Number(e.target.value));
                setScrub(null);
              }}
              aria-label={t('player.nowPlaying')}
            />
            <div className="times">
              <span>{clock(shown)}</span>
              <span>-{clock(Math.max(0, duration - shown))}</span>
            </div>
          </div>

          <div className="transport">
            <button type="button" className={`t-btn ${shuffle ? 'on' : ''}`} onClick={() => setShuffle(!shuffle)} aria-label={t('player.shuffle')} aria-pressed={shuffle}>
              <Icon.shuffle />
            </button>
            <button type="button" className="t-btn" onClick={prev} aria-label={t('player.previous')}>
              <Icon.prev />
            </button>
            <button type="button" className="t-btn big" onClick={toggle} aria-label={playing ? t('player.pause') : t('player.play')} disabled={!current}>
              {playing ? <Icon.pause /> : <Icon.play />}
            </button>
            <button type="button" className="t-btn" onClick={next} aria-label={t('player.next')}>
              <Icon.next />
            </button>
            <button type="button" className={`t-btn ${repeat !== 'off' ? 'on' : ''}`} onClick={cycleRepeat} aria-label={repeat === 'one' ? t('player.repeatOne') : t('player.repeat')}>
              {repeat === 'one' ? <Icon.repeatOne /> : <Icon.repeat />}
            </button>
          </div>

          {error && <p className="hint" role="status">{error}</p>}

          <div className="now-actions">
            <button type="button" className={`chip ${fav ? 'on' : ''}`} onClick={flipFavourite} disabled={!current} title={t('player.favourite')}>
              {fav ? <Icon.heartOn /> : <Icon.heart />}
              <span className="chip-label">{t('player.favourite')}</span>
            </button>
            {current && <AddToPlaylist trackIds={[current.id]} />}
            <button type="button" className={`chip ${queueOpen ? 'on' : ''}`} onClick={() => setQueueOpen((v) => !v)} title={t('player.queue')}>
              <Icon.queue />
              <span className="chip-label">{t('player.queue')}</span>
            </button>
          </div>

          {queueOpen && (
            <div className="queue">
              <h3>{t('player.queue')}</h3>
              {upNext.length ? (
                upNext.map((track, i) => (
                  <div className="track" key={`${track.id}-${i}`} role="button" tabIndex={0} onClick={() => goTo(slot + i + 1)} onKeyDown={(e) => e.key === 'Enter' && goTo(slot + i + 1)}>
                    <span className="idx">{i + 1}</span>
                    <span className="thumb art">
                      {coverFor(track.cover) ? <img src={coverFor(track.cover)} alt="" /> : <span className="mono">··</span>}
                    </span>
                    <span className="meta">
                      <b>{track.title}</b>
                      <span>{track.artist}</span>
                    </span>
                    <span className="dur">{clock(track.duration)}</span>
                  </div>
                ))
              ) : (
                <p className="hint">{t('player.queueEmpty')}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
