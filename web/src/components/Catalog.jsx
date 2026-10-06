import { useState } from 'react';
import { clock } from '../lib/format.js';
import { KIND_ICON } from '../lib/kinds.js';
import { DEMO, playUrl } from '../lib/api.js';
import { warmGradient } from '../lib/art.js';
import { Icon } from './Icons.jsx';
import { Section } from './Tile.jsx';
import { useLibrary } from '../state/library.jsx';
import { usePlayer } from '../state/player.jsx';
import { useUi } from '../state/ui.jsx';

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
  link: item.link ?? null,
  /* Full Laxan always streams through the server (Range, CORS, yt-dlp). The public demo has
     no converter, so a row with only a creator link plays their own page. */
  src: DEMO ? (item.audio || (item.link ? null : playUrl(streamKey(item)))) : playUrl(streamKey(item)),
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

function useStreamPlay(item) {
  const { tracks = [] } = useLibrary();
  const { playList, current, playing, loading, toggle } = usePlayer();
  const key = streamKey(item);
  const saved = tracks.find((x) => x.id === item.savedTrackId || (!!item.id && x.source_id === item.id)) ?? null;
  const onAir = Boolean(current) && (current.id === key || (saved ? current.id === saved.id : false));
  const waiting = onAir && loading;

  const playOne = () => {
    if (onAir) return toggle();
    if (saved) return playList([saved], 0);
    return playList([streamTrack(item)], 0);
  };

  const playFrom = (list) => {
    if (onAir) return toggle();
    const queue = list.map((row) => {
      const hit = tracks.find((x) => x.id === row.savedTrackId || (!!row.id && x.source_id === row.id));
      return hit ?? streamTrack(row);
    });
    const start = Math.max(
      0,
      list.findIndex((x) => streamKey(x) === key)
    );
    playList([...queue.slice(start), ...queue.slice(0, start)], 0);
  };

  return { onAir, waiting, playing: onAir && playing, playOne, playFrom };
}

/** Spotify-style album card — tap the cover to play. */
export function CatalogCard({ item }) {
  const { t } = useUi();
  const { onAir, waiting, playing, playOne } = useStreamPlay(item);
  const label = waiting ? t('player.preparing') : onAir && playing ? t('player.pause') : t('player.play');

  return (
    <article className={`cat ${onAir ? 'on-air' : ''} ${waiting ? 'waiting' : ''}`}>
      <button type="button" className="cat-art" onClick={playOne} title={label} aria-label={`${label} — ${item.title}`}>
        <Poster src={item.thumbnail} kind={item.kind} seed={item.title} />
        <span className="cat-fab">
          {waiting ? <Icon.disc className="spin" /> : onAir && playing ? <Icon.pause /> : <Icon.play />}
        </span>
      </button>
      <div className="cat-meta">
        <b>{item.title}</b>
        <span>
          {item.channelId ? <a href={`#/channels/${item.channelId}`}>{item.channel}</a> : item.channel}
          {item.duration ? ` · ${clock(item.duration)}` : ''}
        </span>
      </div>
    </article>
  );
}

/** Numbered stream row — whole row plays. */
export function StreamRow({ item, index, list }) {
  const { t } = useUi();
  const { onAir, waiting, playing, playFrom } = useStreamPlay(item);

  return (
    <div
      className={`track stream-row ${onAir ? 'current' : ''} ${waiting ? 'waiting' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => playFrom(list)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playFrom(list);
        }
      }}
    >
      <span className="idx" aria-hidden="true">
        {waiting ? (
          <Icon.disc className="spin" />
        ) : onAir && playing ? (
          <span className="bars">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <>
            <span className="idx-num">{index + 1}</span>
            <span className="idx-play" title={t('player.play')}>
              <Icon.play />
            </span>
          </>
        )}
      </span>

      <span className="thumb">
        <Poster src={item.thumbnail} kind={item.kind} seed={item.title} />
      </span>

      <span className="meta">
        <b>{item.title}</b>
        <span>{item.channel}</span>
      </span>

      <span className="dur">{item.duration ? clock(item.duration) : ''}</span>
    </div>
  );
}

export function CatalogRow({ items, title, more }) {
  if (!items?.length) return null;
  const body = (
    <div className="card-row">
      {items.map((item) => (
        <CatalogCard key={item.key ?? `${item.channelId}:${item.id}`} item={item} />
      ))}
    </div>
  );
  return title ? <Section title={title} more={more}>{body}</Section> : body;
}

/** Same cards, but the row wraps instead of scrolling — for a page that is all one shelf. */
export function CatalogGrid({ items }) {
  return (
    <div className="cat-grid">
      {items.map((item) => (
        <CatalogCard key={item.key ?? `${item.channelId}:${item.id}`} item={item} />
      ))}
    </div>
  );
}

/** Numbered list for a whole shelf. */
export function StreamList({ items }) {
  if (!items?.length) return null;
  return (
    <div className="track-list stream-list">
      {items.map((item, i) => (
        <StreamRow key={item.key ?? `${item.channelId}:${item.id}`} item={item} index={i} list={items} />
      ))}
    </div>
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
