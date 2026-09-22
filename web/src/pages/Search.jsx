import { useEffect, useMemo, useState } from 'react';
import { CatalogRow } from '../components/Catalog.jsx';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { Tile } from '../components/Tile.jsx';
import { TrackRow } from '../components/TrackRow.jsx';
import { api } from '../lib/api.js';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

export function Search() {
  const { t, count } = useUi();
  const { tracks = [], artists = [], albums = [], playlists = [] } = useLibrary();
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState(null);

  /* The library answers instantly; the channels need a request, so it is debounced. The
     response carries its own query, so a slow answer to an old word is simply ignored. */
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setRemote(null);
      return undefined;
    }
    let alive = true;
    (async () => {
      await wait(300);
      const res = await api.search(needle).catch(() => null);
      if (alive && res) setRemote(res);
    })();
    return () => {
      alive = false;
    };
  }, [q]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return null;
    const local = {
      tracks: tracks.filter((x) => (x.title + ' ' + (x.artist ?? '') + ' ' + (x.album ?? '')).toLowerCase().includes(needle)).slice(0, 40),
      artists: artists.filter((x) => x.name.toLowerCase().includes(needle)).slice(0, 8),
      albums: albums.filter((x) => `${x.title} ${x.artist ?? ''}`.toLowerCase().includes(needle)).slice(0, 8),
      playlists: playlists.filter((x) => x.name.toLowerCase().includes(needle)).slice(0, 8),
    };
    const fresh = remote && remote.query.toLowerCase() === needle ? remote : null;
    return { ...local, catalog: fresh?.catalog ?? [], loading: !fresh };
  }, [albums, artists, playlists, q, remote, tracks]);

  const nothing = results && !results.tracks.length && !results.artists.length && !results.albums.length && !results.playlists.length && !results.catalog.length;

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
        <p className="hint browse-hint">{t('search.empty')}</p>
      ) : nothing && !results.loading ? (
        <p className="hint browse-hint">{t('search.noResults', { q })}</p>
      ) : (
        <>
          {results.catalog.length > 0 && (
            <CatalogRow title={t('search.catalog')} items={results.catalog.slice(0, 12)} />
          )}

          {results.tracks.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>{t('search.inLibrary')}</h2>
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
