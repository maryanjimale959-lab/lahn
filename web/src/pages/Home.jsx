import { CatalogRow, ShelfSkeleton, streamTrack } from '../components/Catalog.jsx';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { Section, Tile } from '../components/Tile.jsx';
import { shelfTitle } from '../lib/shelves.js';
import { useShelves } from '../lib/useShelves.js';
import { useMine } from '../lib/useMine.js';
import { INTEREST_ART } from '../lib/kinds.js';
import { useAuth } from '../state/auth.jsx';
import { useLibrary } from '../state/library.jsx';
import { usePlayer } from '../state/player.jsx';
import { useUi } from '../state/ui.jsx';

const STEPS = ['home.step1', 'home.step2', 'home.step3'];

const partOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return hour < 21 ? 'evening' : 'night';
};

/** The six short cuts along the top, the way Spotify opens its home. */
function QuickPicks({ shelves }) {
  const { t } = useUi();
  const { playList } = usePlayer();
  const picks = shelves.filter((s) => s.items?.length).slice(0, 6);
  if (!picks.length) return null;

  return (
    <div className="quick">
      {picks.map((shelf) => {
        const Glyph = Icon[INTEREST_ART[shelf.id]] ?? Icon.library;
        return (
          <a className="quick-tile" key={shelf.id} href={`#/shelf/${shelf.id}`}>
            <span className="quick-art">
              <Glyph />
            </span>
            <b>{t(shelfTitle(shelf.id))}</b>
            <span
              className="play-fab"
              role="button"
              tabIndex={-1}
              aria-label={t('player.play')}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                playList(shelf.items.slice(0, 12).map(streamTrack), 0);
              }}
            >
              <Icon.play />
            </span>
          </a>
        );
      })}
    </div>
  );
}

/**
 * Everything Laxan carries, one tap wide. The rows below are only what she picked; these chips
 * are how she reaches the rest without digging through the nav.
 */
function ShelfChips({ shelves, picked }) {
  const { t } = useUi();
  const list = shelves.filter((shelf) => shelf.id !== 'fresh' && shelf.id !== 'foryou');
  if (list.length < 2) return null;

  return (
    <div className="shelf-chips">
      {list.map((shelf) => (
        <a key={shelf.id} className={`chip ${picked.includes(shelf.id) ? 'on' : ''}`} href={`#/shelf/${shelf.id}`}>
          {t(shelfTitle(shelf.id))}
        </a>
      ))}
    </div>
  );
}

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
  const { t, count } = useUi();
  const { user } = useAuth();
  const { stats, recent = [], popular = [], spoken = [], artists, albums, playlists } = useLibrary();
  const { history } = useMine();
  const { shelves, picked, ready, loaded, error, reload } = useShelves();
  const greeting = `${t(`home.greet.${partOfDay()}`)}${user?.name ? `, ${user.name}` : ''}`;
  const pickedSet = new Set(picked);
  /* What she chose during sign-up is the app she gets. "Made for you" is still there, and
     everything else stays one tap away in Browse. */
  const rows = pickedSet.size ? shelves.filter((shelf) => pickedSet.has(shelf.id) || shelf.id === 'foryou') : shelves;
  const played = history.map((row) => {
    const [channelId, id] = String(row.item_key).split(':');
    return { key: row.item_key, id, channelId, channel: row.channel, title: row.title, thumbnail: row.thumbnail, duration: row.duration, kind: row.kind ?? 'song' };
  });

  return (
    <>
      <PageHeader title={greeting} />

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
        <>
          {played.length > 0 && <CatalogRow title={t('home.continue')} items={played.slice(0, 12)} />}
          <ShelfChips shelves={shelves} picked={picked} />
          <QuickPicks shelves={rows} />
          {rows.map((shelf) => (
            <CatalogRow key={shelf.id} title={t(shelfTitle(shelf.id))} more={`#/shelf/${shelf.id}`} items={shelf.items.slice(0, 12)} />
          ))}
        </>
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

      {recent.length > 0 && (
        <Section title={t('home.recent')} more="#/songs">
          <div className="card-row">
            {recent.map((track) => (
              <Tile key={track.id} to="#/songs" track={track} subtitle={track.artist ?? track.channel ?? ''} />
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

      {!stats?.tracks && stats && <Onboard />}
    </>
  );
}
