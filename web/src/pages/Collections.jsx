import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { longDuration } from '../lib/format.js';
import { Art } from '../components/Art.jsx';
import { streamTrack } from '../components/Catalog.jsx';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { Tile } from '../components/Tile.jsx';
import { TrackRow } from '../components/TrackRow.jsx';
import { usePlayer } from '../state/player.jsx';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

function DetailHeader({ title, subtitle, lines, cover, tracks, round }) {
  const { t, lang } = useUi();
  const { playList } = usePlayer();
  const seconds = (tracks ?? []).reduce((sum, x) => sum + (x.duration ?? 0), 0);

  return (
    <div className="detail-head">
      <Art cover={cover} name={title} className={`detail-art${round ? ' round' : ''}`} />
      <div className="detail-meta">
        <span className="crumb">{subtitle}</span>
        <h2>{title}</h2>
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        {tracks?.length ? (
          <div className="detail-cta">
            <button type="button" className="pill-btn" onClick={() => playList(tracks, 0)}>
              <Icon.play />
              {t('common.playAll')}
            </button>
            <button type="button" className="pill-btn ghost" onClick={() => playList([...tracks].sort(() => Math.random() - 0.5), 0)}>
              <Icon.shuffle />
              {t('detail.shuffle')}
            </button>
          </div>
        ) : null}
        {seconds ? <p className="hint">{longDuration(seconds, lang)}</p> : null}
      </div>
    </div>
  );
}

export function Playlists() {
  const { t, count } = useUi();
  const { playlists = [], refresh } = useLibrary();

  const create = useCallback(async () => {
    const name = window.prompt(t('playlists.namePrompt'), '');
    if (!name?.trim()) return;
    try {
      await api.createPlaylist(name.trim());
      await refresh();
    } catch (err) {
      window.alert(err.message);
    }
  }, [refresh, t]);

  return (
    <>
      <PageHeader title={t('playlists.title')}>
        <button type="button" className="icon-btn" onClick={create} aria-label={t('playlists.new')} title={t('playlists.new')}>
          <Icon.plus />
        </button>
      </PageHeader>
      {!playlists.length ? (
        <div className="onboard">
          <h2>{t('playlists.title')}</h2>
          <p>{t('playlists.empty')}</p>
          <button type="button" className="pill-btn" onClick={create}>
            <Icon.plus />
            {t('playlists.new')}
          </button>
        </div>
      ) : (
        <div className="grid">
          {playlists.map((pl) => (
            <Tile key={pl.id} to={`#/playlists/${pl.id}`} title={pl.name} subtitle={count(pl.track_count, 'song')} cover={pl.cover} />
          ))}
        </div>
      )}
    </>
  );
}

export function PlaylistPage({ id }) {
  const { t, count } = useUi();
  const { refresh } = useLibrary();
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const res = await api.playlist(id);
    setData(res);
  }, [id]);

  useEffect(() => {
    load().catch(() => setData(null));
  }, [load]);

  if (!data) return null;
  const { playlist, tracks } = data;

  const rename = async () => {
    const name = window.prompt(t('playlists.rename'), playlist.name);
    if (!name?.trim()) return;
    await api.renamePlaylist(id, { name: name.trim() });
    await Promise.all([load(), refresh()]);
  };

  const remove = async (trackId) => {
    await api.removeFromPlaylist(id, trackId);
    await Promise.all([load(), refresh()]);
  };

  const drop = async () => {
    if (!window.confirm(`${t('playlists.delete')} — ${playlist.name}?`)) return;
    await api.deletePlaylist(id);
    await refresh();
    window.location.hash = '#/playlists';
  };

  return (
    <>
      <PageHeader title={t('nav.playlists')} />
      <DetailHeader
        title={playlist.name}
        subtitle={t('nav.playlists')}
        lines={[count(tracks.length, 'song')]}
        cover={tracks[0]?.cover}
        tracks={tracks}
      />
      <div className="detail-tools">
        <button type="button" className="chip" onClick={rename}>
          <Icon.playlist />
          {t('playlists.rename')}
        </button>
        <button type="button" className="chip" onClick={drop}>
          <Icon.trash />
          {t('playlists.delete')}
        </button>
      </div>
      {tracks.length ? (
        <div className="track-list">
          {tracks.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} list={tracks} onRemove={() => remove(track.id)} />
          ))}
        </div>
      ) : (
        <p className="hint">{t('playlists.noSongs')}</p>
      )}
    </>
  );
}

export function ArtistPage({ id }) {
  const { t, count } = useUi();
  const { tracks = [] } = useLibrary();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.artist(id).then(setData).catch(() => setData(null));
  }, [id]);

  const mine = tracks.filter((x) => x.artist_id === id);
  if (!data && !mine.length) return null;
  /* A curated artist is a saved search rather than a row in the database, so her songs come off
     a shelf and stream from there instead of playing a file. */
  const list = data?.items?.length
    ? data.items.map(streamTrack)
    : data?.tracks?.length
      ? data.tracks
      : mine;

  return (
    <>
      <PageHeader title={t('nav.artists')} />
      <DetailHeader round title={data?.artist?.name ?? ''} subtitle={t('nav.artists')} lines={[count(list.length, 'song')]} cover={data?.artist?.image} tracks={list} />
      <div className="track-list">
        {list.map((track, i) => (
          <TrackRow key={track.id} track={track} index={i} list={list} showArtist={false} />
        ))}
      </div>
    </>
  );
}

export function AlbumPage({ id }) {
  const { t, count } = useUi();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.album(id).then(setData).catch(() => setData(null));
  }, [id]);

  if (!data) return null;
  const { album, tracks } = data;

  return (
    <>
      <PageHeader title={t('nav.albums')} />
      <DetailHeader
        title={album.title}
        subtitle={album.artist ?? ''}
        lines={[count(tracks.length, 'song'), album.year ? String(album.year) : null].filter(Boolean)}
        cover={album.image}
        tracks={tracks}
      />
      <div className="track-list">
        {tracks.map((track, i) => (
          <TrackRow key={track.id} track={track} index={i} list={tracks} showAlbum={false} />
        ))}
      </div>
    </>
  );
}
