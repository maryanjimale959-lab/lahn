import { useMemo } from 'react';
import { CatalogRow, StreamList, streamTrack } from '../components/Catalog.jsx';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { Tile } from '../components/Tile.jsx';
import { shelfTitle } from '../lib/shelves.js';
import { useShelves } from '../lib/useShelves.js';
import { useLibrary } from '../state/library.jsx';
import { usePlayer } from '../state/player.jsx';
import { useUi } from '../state/ui.jsx';

const MUSIC_SHELVES = ['music', 'rap', 'love'];

export function Songs() {
  const { t, count } = useUi();
  const { playList } = usePlayer();
  const { shelves, loaded } = useShelves();
  const musicShelves = shelves.filter((shelf) => MUSIC_SHELVES.includes(shelf.id));
  const allItems = useMemo(() => musicShelves.flatMap((s) => s.items ?? []), [musicShelves]);

  const playAll = () => {
    if (!allItems.length) return;
    playList(allItems.slice(0, 80).map(streamTrack), 0);
  };

  return (
    <>
      <PageHeader title={t('songs.title')}>
        {allItems.length > 0 && (
          <button type="button" className="pill-btn play-all" onClick={playAll}>
            <Icon.play />
            {t('common.playAll')}
          </button>
        )}
      </PageHeader>

      {!loaded ? (
        <p className="hint">{t('home.loading')}</p>
      ) : !allItems.length ? (
        <div className="onboard">
          <h2>{t('home.emptyTitle')}</h2>
          <p>{t('home.emptyBody')}</p>
        </div>
      ) : (
        <>
          {musicShelves.map((shelf) => (
            <CatalogRow key={shelf.id} title={t(shelfTitle(shelf.id))} more={`#/shelf/${shelf.id}`} items={shelf.items.slice(0, 12)} />
          ))}
          <h2 className="list-heading">{t('songs.title')}</h2>
          <p className="shelf-count">{count(allItems.length, 'song')}</p>
          <StreamList items={allItems.slice(0, 60)} />
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
