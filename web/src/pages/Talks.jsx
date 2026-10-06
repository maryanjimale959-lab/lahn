import { useEffect, useMemo, useState } from 'react';
import { StreamList, streamTrack } from '../components/Catalog.jsx';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { api } from '../lib/api.js';
import { KIND_SHELF, TALKS } from '../lib/kinds.js';
import { usePlayer } from '../state/player.jsx';
import { useUi } from '../state/ui.jsx';

const isTalk = (kind) => TALKS.includes(kind);

export function Talks({ kind = 'podcast' }) {
  const { t, count } = useUi();
  const { playList } = usePlayer();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const active = isTalk(kind) ? kind : 'podcast';

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError(null);
    api
      .catalog({ kind: active })
      .then((res) => {
        if (alive) setItems(res.items ?? []);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [active]);

  const list = useMemo(() => items ?? [], [items]);

  const playAll = () => {
    if (!list.length) return;
    playList(list.map(streamTrack), 0);
  };

  return (
    <>
      <PageHeader title={t('nav.talks')}>
        {list.length > 0 && (
          <button type="button" className="pill-btn play-all" onClick={playAll}>
            <Icon.play />
            {t('common.playAll')}
          </button>
        )}
      </PageHeader>

      <div className="sortbar" role="tablist">
        {TALKS.map((value) => (
          <a key={value} href={`#/talks/${value}`} className={`chip ${active === value ? 'on' : ''}`} aria-current={active === value || undefined}>
            {t(`talks.${KIND_SHELF[value]}`)}
          </a>
        ))}
      </div>

      {error && (
        <p className="hint" role="alert">
          <span className="err">{error}</span>
        </p>
      )}

      {items === null ? (
        <p className="hint">{t('home.loading')}</p>
      ) : !list.length ? (
        <div className="onboard">
          <h2>{t(`talks.empty.${active}`)}</h2>
          <p>{t('talks.emptyBody')}</p>
        </div>
      ) : (
        <>
          <p className="shelf-count">{count(list.length, active)}</p>
          <StreamList items={list} />
        </>
      )}
    </>
  );
}
