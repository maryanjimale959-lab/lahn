import { useEffect, useMemo, useState } from 'react';
import { CatalogRow } from '../components/Catalog.jsx';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { TrackRow } from '../components/TrackRow.jsx';
import { api } from '../lib/api.js';
import { clock } from '../lib/format.js';
import { KIND_SHELF, TALKS } from '../lib/kinds.js';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

const isTalk = (kind) => TALKS.includes(kind);

const SORTS = [
  ['recent', 'songs.sort.recent'],
  ['title', 'songs.sort.title'],
  ['plays', 'songs.sort.plays'],
];

export function Talks({ kind = 'podcast' }) {
  const { t, count } = useUi();
  const { tracks = [], channels = [] } = useLibrary();
  const [sort, setSort] = useState('recent');
  const [toSave, setToSave] = useState([]);
  const active = isTalk(kind) ? kind : 'podcast';

  const saved = useMemo(() => tracks.filter((track) => track.kind === active), [tracks, active]);

  const list = useMemo(() => {
    const copy = [...saved];
    if (sort === 'title') copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    else if (sort === 'plays') copy.sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0) || b.added_at - a.added_at);
    else copy.sort((a, b) => b.added_at - a.added_at);
    return copy;
  }, [saved, sort]);

  /* The shelf behind a filter: whatever the channels have published that she has not kept yet. */
  useEffect(() => {
    let alive = true;
    api.catalog({ kind: active }).then((res) => alive && setToSave(res.items ?? []));
    return () => {
      alive = false;
    };
  }, [active, tracks]);

  const total = saved.reduce((sum, x) => sum + x.duration, 0);
  const toKeep = toSave.filter((x) => !x.savedTrackId).slice(0, 12);

  return (
    <>
      <PageHeader title={t('nav.talks')}>
        <a className="pill-btn ghost" href="#/channels">
          <Icon.channel />
          {t('nav.channels')}
          {channels.length > 0 && <span className="pill-count">{channels.length}</span>}
        </a>
      </PageHeader>

      <div className="sortbar" role="tablist">
        {TALKS.map((value) => {
          const n = tracks.filter((track) => track.kind === value).length;
          return (
            <a key={value} href={`#/talks/${value}`} className={`chip ${active === value ? 'on' : ''}`} aria-current={active === value || undefined}>
              {t(`talks.${KIND_SHELF[value]}`)}
              <span className="chip-count">{count(n, value)}</span>
            </a>
          );
        })}
      </div>

      {list.length > 0 && (
        <>
          <div className="sortbar">
            {SORTS.map(([value, key]) => (
              <button key={value} type="button" className={`chip ${sort === value ? 'on' : ''}`} onClick={() => setSort(value)}>
                {t(key)}
              </button>
            ))}
            <span className="sort-count">
              {count(list.length, active)} · {clock(total)}
            </span>
          </div>
          <div className="track-list">
            {list.map((track, i) => (
              <TrackRow key={track.id} track={track} index={i} list={list} showAlbum={false} />
            ))}
          </div>
        </>
      )}

      {!list.length && (
        <div className={`onboard ${toKeep.length ? 'compact' : ''}`}>
          <h2>{t(`talks.empty.${active}`)}</h2>
          <p>{t('talks.emptyBody')}</p>
          <a className="pill-btn" href="#/channels">
            <Icon.channel />
            {t('talks.browse')}
          </a>
        </div>
      )}

      <CatalogRow title={t('talks.fromChannels')} items={toKeep} />
    </>
  );
}
