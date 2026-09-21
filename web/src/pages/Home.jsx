import { longDuration, bytes } from '../lib/format.js';
import { arabicDigits } from '../lib/i18n.js';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { Section, Tile } from '../components/Tile.jsx';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

const STEPS = ['home.step1', 'home.step2', 'home.step3'];

function Onboard() {
  const { t, lang } = useUi();
  const { setAddOpen } = useLibrary();
  const num = (n) => (lang === 'ar' ? arabicDigits(n) : String(n));

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
          <Icon.artist />
        </span>
      </div>
      <h2>{t('home.emptyTitle')}</h2>
      <p>{t('home.emptyBody')}</p>
      <ol className="steps">
        {STEPS.map((key, i) => (
          <li key={key}>
            <b>{num(i + 1)}</b>
            {t(key)}
          </li>
        ))}
      </ol>
      <div>
        <button type="button" className="pill-btn big-cta" onClick={() => setAddOpen(true)}>
          <Icon.plus />
          {t('home.addFirst')}
        </button>
      </div>
    </div>
  );
}

export function Home() {
  const { t, lang, count } = useUi();
  const { stats, recent, popular, artists, albums, playlists } = useLibrary();

  return (
    <>
      <PageHeader title={t('home.title')} />
      {!stats?.tracks ? (
        <Onboard />
      ) : (
        <>
          <p className="lib-stats">{t('home.stats', { songs: count(stats.tracks, 'song'), time: longDuration(stats.seconds, lang), size: bytes(stats.bytes, lang) })}</p>

          <Section title={t('home.recent')} more="#/songs">
            <div className="card-row">
              {recent.map((track) => (
                <Tile key={track.id} to={`#/songs`} track={track} subtitle={track.artist} />
              ))}
            </div>
          </Section>

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
      )}
    </>
  );
}
