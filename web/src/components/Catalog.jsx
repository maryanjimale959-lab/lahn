import { useState } from 'react';
import { clock } from '../lib/format.js';
import { KIND_ICON } from '../lib/kinds.js';
import { playUrl } from '../lib/api.js';
import { warmGradient } from '../lib/art.js';
import { Icon } from './Icons.jsx';
import { Section } from './Tile.jsx';
import { useLibrary } from '../state/library.jsx';
import { usePlayer } from '../state/player.jsx';
import { useUi } from '../state/ui.jsx';

const STAGE_KEY = { queued: 'add.probing', probing: 'add.probing', downloading: 'add.downloading', saving: 'add.saving' };

/** The key the stream route answers to, and the queue's identity for the same thing. */
export const streamKey = (item) => item.key ?? `${item.channelId}:${item.id}`;

/** A shelf item is playable as it is: no download, no database row, just the stream. */
export const streamTrack = (item) => ({
  id: streamKey(item),
  title: item.title,
  artist: item.channel ?? '',
  album: item.channel ?? '',
  cover: item.thumbnail,
  duration: item.duration ?? 0,
  kind: item.kind,
  src: playUrl(streamKey(item)),
});

/* Remote art fails often enough that a missing poster has to look deliberate. Recitation has no
   poster at all, so the tile earns its own colour from the surah's name rather than showing the
   same flat glyph eleven rows in a row. */
function Poster({ src, kind, seed }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    const Glyph = Icon[KIND_ICON[kind] ?? 'song'] ?? Icon.song;
    return (
      <span className="cat-blank" style={{ backgroundImage: warmGradient(seed) }}>
        <Glyph />
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

export function CatalogCard({ item, onError }) {
  const { t } = useUi();
  const { tracks = [], save, jobs, cancel } = useLibrary();
  const { playList, current, playing, loading } = usePlayer();

  const key = streamKey(item);
  const job = Object.values(jobs).find((j) => j.url === item.url) ?? null;
  const running = job && (job.status === 'queued' || job.status === 'running');
  const failed = job?.status === 'error' || job?.status === 'cancelled';
  const saved = tracks.find((x) => x.id === item.savedTrackId || (!!item.id && x.source_id === item.id)) ?? null;
  /* With nothing playing and nothing saved, both sides of that comparison are
     undefined — which once looked like "this card is already on air" and ate the tap. */
  const onAir = Boolean(current) && (current.id === key || (saved ? current.id === saved.id : false));

  const act = () => {
    if (onAir) return null;
    if (saved) return playList([saved], 0);
    if (running) return null;
    /* The first tap on something never played has to fetch it, which takes a while;
       after that it is already warm and starts at once. */
    return playList([streamTrack(item)], 0);
  };

  const label = onAir
    ? playing
      ? t('player.pause')
      : t('player.play')
    : running
      ? t(STAGE_KEY[job.stage] ?? 'add.downloading')
      : failed
        ? t('add.retry')
        : t('player.play');

  return (
    <article className={`cat ${saved ? 'saved' : ''} ${running ? 'busy' : ''} ${failed ? 'failed' : ''} ${onAir && loading ? 'waiting' : ''}`}>
      <button type="button" className="cat-art" onClick={act} title={label} aria-label={`${label} — ${item.title}`}>
        <Poster src={item.thumbnail} kind={item.kind} seed={item.title} />
        <span className="cat-fab">
          {running ? (
            <span className="cat-pct">{Math.round(job.percent ?? 0)}</span>
          ) : onAir && loading ? (
            <Icon.disc className="spin" />
          ) : onAir && playing ? (
            <Icon.pause />
          ) : (
            <Icon.play />
          )}
        </span>
        {running && (
          <span className="cat-bar" role="progressbar" aria-valuenow={Math.round(job.percent ?? 0)} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${Math.max(4, job.percent ?? 0)}%` }} />
          </span>
        )}
      </button>
      {running && (
        <button
          type="button"
          className="cat-cancel"
          title={t('common.cancel')}
          aria-label={`${t('common.cancel')} — ${item.title}`}
          onClick={() => cancel(job.id).catch((err) => onError?.(err.message))}
        >
          <Icon.close />
        </button>
      )}
      <div className="cat-meta">
        <b>{item.title}</b>
        <span>
          {item.channelId ? <a href={`#/channels/${item.channelId}`}>{item.channel}</a> : item.channel}
          {item.duration ? ` · ${clock(item.duration)}` : ''}
        </span>
      </div>
      {saved || running ? null : (
        <button
          type="button"
          className="cat-save"
          title={t('channels.save')}
          aria-label={`${t('channels.save')} — ${item.title}`}
          onClick={() => save(item.url, { kind: item.kind, channel: item.channelId }).catch((err) => onError?.(err.message))}
        >
          <Icon.download />
        </button>
      )}
    </article>
  );
}

export function CatalogRow({ items, title, more }) {
  const [error, setError] = useState(null);
  if (!items?.length) return null;
  const body = (
    <>
      <div className="card-row">
        {items.map((item) => (
          <CatalogCard key={item.key ?? `${item.channelId}:${item.id}`} item={item} onError={setError} />
        ))}
      </div>
      {error && (
        <p className="hint" role="alert">
          <span className="err">{error}</span>
        </p>
      )}
    </>
  );
  return title ? <Section title={title} more={more}>{body}</Section> : body;
}

/** Same cards, but the row wraps instead of scrolling — for a page that is all one shelf. */
export function CatalogGrid({ items }) {
  const [error, setError] = useState(null);
  return (
    <>
      <div className="cat-grid">
        {items.map((item) => (
          <CatalogCard key={item.key ?? `${item.channelId}:${item.id}`} item={item} onError={setError} />
        ))}
      </div>
      {error && (
        <p className="hint" role="alert">
          <span className="err">{error}</span>
        </p>
      )}
    </>
  );
}

/** Fills a shelf with cards that are still arriving so the row never jumps. */
export function ShelfSkeleton({ n = 6 }) {
  return (
    <div className="card-row" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span className="cat sk" key={i}>
          <span className="cat-art" />
          <span className="cat-meta">
            <b />
            <b className="short" />
          </span>
        </span>
      ))}
    </div>
  );
}
