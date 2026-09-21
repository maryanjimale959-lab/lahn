import { useMemo, useState } from 'react';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { Tile } from '../components/Tile.jsx';
import { TrackRow } from '../components/TrackRow.jsx';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

const has = (needle, ...fields) => fields.some((f) => (f ?? '').toLowerCase().includes(needle));

export function Search() {
  const { t, count } = useUi();
  const { tracks = [], artists = [], albums = [], playlists = [] } = useLibrary();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return null;
    return {
      tracks: tracks.filter((x) => has(needle, x.title, x.artist, x.album)).slice(0, 40),
      artists: artists.filter((x) => has(needle, x.name)).slice(0, 8),
      albums: albums.filter((x) => has(needle, x.title, x.artist)).slice(0, 8),
      playlists: playlists.filter((x) => has(needle, x.name)).slice(0, 8),
    };
  }, [albums, artists, playlists, q, tracks]);

  const nothing = results && !results.tracks.length && !results.artists.length && !results.albums.length && !results.playlists.length;

  return (
    <>
      <PageHeader title={t('search.title')} />
      <label className="search-field">
        <Icon.search />
        <input
          type="search"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label={t('common.cancel')}>
            <Icon.close />
          </button>
        )}
      </label>

      {!results ? (
        <p className="hint" style={{ marginTop: 18 }}>{t('search.empty')}</p>
      ) : nothing ? (
        <p className="hint" style={{ marginTop: 18 }}>{t('search.noResults', { q })}</p>
      ) : (
        <>
          {results.tracks.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>{t('search.songs')}</h2>
              </div>
              <div className="track-list">
                {results.tracks.map((track, i) => (
                  <TrackRow key={track.id} track={track} index={i} list={results.tracks} />
                ))}
              </div>
            </section>
          )}

          {results.artists.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>{t('search.artists')}</h2>
              </div>
              <div className="grid">
                {results.artists.map((ar) => (
                  <Tile key={ar.id} to={`#/artists/${ar.id}`} title={ar.name} subtitle={count(ar.track_count, 'song')} cover={ar.image} round />
                ))}
              </div>
            </section>
          )}

          {results.albums.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>{t('search.albums')}</h2>
              </div>
              <div className="grid">
                {results.albums.map((al) => (
                  <Tile key={al.id} to={`#/albums/${al.id}`} title={al.title} subtitle={al.artist ?? ''} cover={al.image} />
                ))}
              </div>
            </section>
          )}

          {results.playlists.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>{t('search.playlists')}</h2>
              </div>
              <div className="grid">
                {results.playlists.map((pl) => (
                  <Tile key={pl.id} to={`#/playlists/${pl.id}`} title={pl.name} subtitle={count(pl.track_count, 'song')} cover={pl.cover} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
