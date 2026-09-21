import { useMemo, useState } from 'react';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { Tile } from '../components/Tile.jsx';
import { TrackRow } from '../components/TrackRow.jsx';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

const SORTS = [
  ['recent', 'songs.sort.recent'],
  ['title', 'songs.sort.title'],
  ['artist', 'songs.sort.artist'],
  ['plays', 'songs.sort.plays'],
];

export function Songs() {
  const { t, count } = useUi();
  const { tracks = [], setAddOpen } = useLibrary();
  const [sort, setSort] = useState('recent');

  const list = useMemo(() => {
    const copy = [...tracks];
    if (sort === 'title') copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    else if (sort === 'artist') copy.sort((a, b) => (a.artist ?? '').localeCompare(b.artist ?? '', undefined, { sensitivity: 'base' }) || a.title.localeCompare(b.title));
    else if (sort === 'plays') copy.sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0) || b.added_at - a.added_at);
    else copy.sort((a, b) => b.added_at - a.added_at);
    return copy;
  }, [tracks, sort]);

  return (
    <>
      <PageHeader title={t('songs.title')} />
      {!list.length ? (
        <div className="onboard">
          <h2>{t('home.emptyTitle')}</h2>
          <p>{t('home.emptyBody')}</p>
          <button type="button" className="pill-btn" onClick={() => setAddOpen(true)}>
            <Icon.plus />
            {t('add.title')}
          </button>
        </div>
      ) : (
        <>
          <div className="sortbar" role="tablist">
            {SORTS.map(([value, key]) => (
              <button key={value} type="button" role="tab" aria-selected={sort === value} className={`chip ${sort === value ? 'on' : ''}`} onClick={() => setSort(value)}>
                {t(key)}
              </button>
            ))}
            <span className="sort-count">{count(list.length, 'song')}</span>
          </div>
          <div className="track-list">
            {list.map((track, i) => (
              <TrackRow key={track.id} track={track} index={i} list={list} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function Artists() {
  const { t, count } = useUi();
  const { artists = [] } = useLibrary();

  return (
    <>
      <PageHeader title={t('artists.title')} />
      {!artists.length ? (
        <p className="hint">{t('songs.empty')}</p>
      ) : (
        <div className="grid">
          {artists.map((ar) => (
            <Tile key={ar.id} to={`#/artists/${ar.id}`} title={ar.name} subtitle={count(ar.track_count, 'song')} cover={ar.image} round />
          ))}
        </div>
      )}
    </>
  );
}

export function Albums() {
  const { t } = useUi();
  const { albums = [] } = useLibrary();

  return (
    <>
      <PageHeader title={t('albums.title')} />
      {!albums.length ? (
        <p className="hint">{t('songs.empty')}</p>
      ) : (
        <div className="grid">
          {albums.map((al) => (
            <Tile key={al.id} to={`#/albums/${al.id}`} title={al.title} subtitle={al.artist ?? ''} cover={al.image} />
          ))}
        </div>
      )}
    </>
  );
}
