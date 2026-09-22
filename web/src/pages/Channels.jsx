import { useEffect, useState } from 'react';
import { CatalogGrid } from '../components/Catalog.jsx';
import { Icon } from '../components/Icons.jsx';
import { Art } from '../components/Art.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { Section, Tile } from '../components/Tile.jsx';
import { TrackRow } from '../components/TrackRow.jsx';
import { api } from '../lib/api.js';
import { KIND_ICON, KIND_KEY, TALKS } from '../lib/kinds.js';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

const asItem = (entry, channel) => ({ ...entry, kind: channel.kind, channelId: channel.id, channel: channel.name });

export function Channels() {
  const { t, count } = useUi();
  const { channels = [], refresh } = useLibrary();
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState('podcast');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const link = url.trim();
    if (!link) return;
    setBusy(true);
    setError(null);
    try {
      await api.addChannel(link, kind);
      setUrl('');
      setAdding(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  /* One tap refreshes every source at once; the server de-duplicates, so pressing it twice is safe. */
  const sweep = async () => {
    setSweeping(true);
    setError(null);
    try {
      await api.refreshChannels();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSweeping(false);
    }
  };

  return (
    <>
      <PageHeader title={t('channels.title')}>
        <button type="button" className="pill-btn ghost" onClick={sweep} disabled={sweeping}>
          <span className={sweeping ? 'spin' : ''}>
            <Icon.repeat />
          </span>
          {t('channels.refreshAll')}
        </button>
        <button type="button" className="pill-btn" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          <Icon.plus />
          {t('channels.follow')}
        </button>
      </PageHeader>

      {adding && (
        <form className="add-channel" onSubmit={submit}>
          <input
            type="url"
            dir="ltr"
            spellCheck={false}
            autoComplete="off"
            placeholder={t('channels.placeholder')}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
          />
          <span className="spacer" />
          <div className="kind-picker inline" role="group" aria-label={t('channels.title')}>
            {TALKS.map((value) => {
              const Glyph = Icon[KIND_ICON[value]];
              return (
                <button key={value} type="button" aria-pressed={kind === value} className={`chip ${kind === value ? 'on' : ''}`} onClick={() => setKind(value)}>
                  <Glyph />
                  {t(KIND_KEY[value])}
                </button>
              );
            })}
          </div>
          <button type="submit" className="pill-btn" disabled={busy || !url.trim()}>
            <Icon.plus />
            {t('channels.follow')}
          </button>
        </form>
      )}

      <p className="hint">{error ? <span className="err">{error}</span> : t('channels.hint')}</p>

      <Section title={t('channels.following')}>
        {!channels.length ? (
          <p className="hint">{t('channels.none')}</p>
        ) : (
          <div className="grid">
            {channels.map((c) => (
              <Tile key={c.id} to={`#/channels/${c.id}`} title={c.name} subtitle={count(c.uploadCount, c.kind)} cover={c.image ?? c.preview} round={c.kind === 'song'} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

export function ChannelPage({ id }) {
  const { t, count } = useUi();
  const { refresh } = useLibrary();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pulling, setPulling] = useState(false);

  /* The list has to be there before she can save anything, so the first visit pulls it
     once and then rides the cache. */
  useEffect(() => {
    let alive = true;
    setError(null);
    setData(null);
    (async () => {
      const first = await api.channel(id).catch((err) => {
        setError(err.message);
        return null;
      });
      if (!alive || !first) return;
      setData(first);
      if (!first.fresh) {
        setPulling(true);
        try {
          setData(await api.refreshChannel(id));
        } catch (err) {
          setError(err.message);
        } finally {
          setPulling(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const pull = async () => {
    setPulling(true);
    setError(null);
    try {
      setData(await api.refreshChannel(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setPulling(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t('channels.unfollowConfirm', { name: data.channel.name }))) return;
    await api.deleteChannel(id);
    await refresh();
    window.location.hash = '#/channels';
  };

  if (!data) {
    return (
      <>
        <PageHeader title={t('channels.title')} />
        <p className="hint">{error ?? t('channels.loading')}</p>
      </>
    );
  }

  const { channel, uploads, tracks } = data;
  const KindIcon = Icon[KIND_ICON[channel.kind]];

  return (
    <>
      <PageHeader title={channel.name}>
        <button type="button" className="icon-btn" onClick={pull} disabled={pulling} title={t('channels.refresh')} aria-label={t('channels.refresh')}>
          <span className={pulling ? 'spin' : ''}>
            <Icon.repeat />
          </span>
        </button>
        <button type="button" className="icon-btn" onClick={remove} title={t('channels.unfollow')} aria-label={t('channels.unfollow')}>
          <Icon.trash />
        </button>
      </PageHeader>

      <div className="channel-head">
        <Art cover={channel.image ?? uploads[0]?.thumbnail} name={channel.name} className="channel-art" />
        <div className="channel-sum">
          <p className="eyebrow">
            <KindIcon />
            {t(KIND_KEY[channel.kind])}
          </p>
          <h2>{channel.name}</h2>
          <p className="hint">
            {count(tracks.length, channel.kind)} · {uploads.length} {t('channels.latestCount')}
          </p>
        </div>
      </div>

      {error && (
        <p className="hint" role="alert">
          <span className="err">{error}</span>
        </p>
      )}

      {tracks.length > 0 && (
        <Section title={t('channels.inLibrary')}>
          <div className="track-list">
            {tracks.map((track, i) => (
              <TrackRow key={track.id} track={track} index={i} list={tracks} showAlbum={false} />
            ))}
          </div>
        </Section>
      )}

      <Section title={t('channels.latest')}>
        {uploads.length ? <CatalogGrid items={uploads.map((entry) => asItem(entry, channel))} /> : <p className="hint">{t('channels.noneYet')}</p>}
      </Section>
    </>
  );
}
