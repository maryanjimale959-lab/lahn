import { CatalogRow, ShelfSkeleton } from '../components/Catalog.jsx';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { Section, Tile } from '../components/Tile.jsx';
import { shelfTitle } from '../lib/shelves.js';
import { useShelves } from '../lib/useShelves.js';
import { bytes, longDuration } from '../lib/format.js';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

const STEPS = ['home.step1', 'home.step2', 'home.step3'];

function Onboard() {
  const { t } = useUi();
  return (
    <div className="onboard">
      <div className="fan" aria-hidden="true">
        <span className="fan-card c1">
          <Icon.song />
        </span>
        <span className="fan-card c2">
          <Icon.disc />
        </span>
        <span className="fan-card c3">
          <Icon.mic />
        </span>
      </div>
      <h2>{t('home.emptyTitle')}</h2>
      <p>{t('home.emptyBody')}</p>
      <ol className="steps">
        {STEPS.map((key, i) => (
          <li key={key}>
            <b>{i + 1}</b>
            {t(key)}
          </li>
        ))}
      </ol>
      <div>
        <a className="pill-btn big-cta" href="#/shelf/music">
          <Icon.library />
          {t('home.addFirst')}
        </a>
      </div>
    </div>
  );
}

export function Home() {
  const { t, lang, count } = useUi();
  const { stats, recent = [], popular = [], spoken = [], artists, albums, playlists } = useLibrary();
  const { shelves, ready, loaded, error, reload } = useShelves();

  return (
    <>
      <PageHeader title={t('home.title')} />

      {!stats?.tracks && stats && <Onboard />}

      {stats?.tracks > 0 && (
        <p className="lib-stats">
          {t('home.stats', { songs: count(stats.songs ?? 0, 'song'), time: longDuration(stats.music_seconds ?? 0, lang), size: bytes(stats.bytes) })}
        </p>
      )}

      {!loaded || (!shelves.length && !error) ? (
        <Section title={t('home.loading')}>
          <ShelfSkeleton />
          <p className="hint">{ready ? t('channels.noneYet') : t('home.loadingHint')}</p>
        </Section>
      ) : error ? (
        <p className="hint" role="alert">
          <span className="err">{error}</span>{' '}
          <button type="button" className="chip" onClick={reload}>
            {t('add.retry')}
          </button>
        </p>
      ) : (
        shelves
          .filter((shelf) => shelf.id !== 'fresh')
          .map((shelf) => (
            <CatalogRow key={shelf.id} title={t(shelfTitle(shelf.id))} more={`#/shelf/${shelf.id}`} items={shelf.items.slice(0, 12)} />
          ))
      )}

      {recent.length > 0 && (
        <Section title={t('home.recent')} more="#/songs">
          <div className="card-row">
            {recent.map((track) => (
              <Tile key={track.id} to="#/songs" track={track} subtitle={track.artist ?? track.channel ?? ''} />
            ))}
          </div>
        </Section>
      )}

      {spoken.length > 0 && (
        <Section title={t('home.talks')} more="#/talks">
          <div className="card-row">
            {spoken.map((track) => (
              <Tile key={track.id} to={`#/talks/${track.kind}`} track={track} subtitle={track.artist} />
            ))}
          </div>
        </Section>
      )}

      {popular.length > 0 && (
        <Section title={t('home.popular')}>
          <div className="card-row">
            {popular.map((track) => (
              <Tile key={track.id} to="#/songs" track={track} subtitle={count(track.plays, 'play')} />
            ))}
          </div>
        </Section>
      )}

      {playlists?.length > 0 && (
        <Section title={t('home.playlists')} more="#/playlists">
          <div className="card-row">
            {playlists.map((pl) => (
              <Tile key={pl.id} to={`#/playlists/${pl.id}`} title={pl.name} subtitle={count(pl.track_count, 'song')} cover={pl.cover} />
            ))}
          </div>
        </Section>
      )}

      {albums?.length > 0 && (
        <Section title={t('nav.albums')} more="#/albums">
          <div className="card-row">
            {albums.map((al) => (
              <Tile key={al.id} to={`#/albums/${al.id}`} title={al.title} subtitle={al.artist} cover={al.image} />
            ))}
          </div>
        </Section>
      )}

      {artists?.length > 0 && (
        <Section title={t('nav.artists')} more="#/artists">
          <div className="card-row">
            {artists.map((ar) => (
              <Tile key={ar.id} to={`#/artists/${ar.id}`} title={ar.name} subtitle={count(ar.track_count, 'song')} cover={ar.image} round />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
