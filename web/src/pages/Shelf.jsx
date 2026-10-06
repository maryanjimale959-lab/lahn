import { useCallback, useEffect, useState } from 'react';
import { StreamList, ShelfSkeleton, streamTrack } from '../components/Catalog.jsx';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { api } from '../lib/api.js';
import { shelfQuery, shelfTitle } from '../lib/shelves.js';
import { usePlayer } from '../state/player.jsx';
import { useUi } from '../state/ui.jsx';

export function Shelf({ id }) {
  const { t, count } = useUi();
  const { playList } = usePlayer();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.catalog(shelfQuery(id));
      setItems(res.items ?? []);
      return res;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError(null);
    (async () => {
      let res = await load();
      /* A cold catalog is still being read, so keep asking until the server says it is done. */
      for (let n = 0; alive && res && !res.ready && n < 40; n += 1) {
        await new Promise((done) => setTimeout(done, 6000));
        if (!alive) return;
        res = await load();
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const playAll = () => {
    if (!items?.length) return;
    playList(items.map(streamTrack), 0);
  };

  return (
    <>
      <PageHeader title={t(shelfTitle(id))}>
        {items?.length > 0 && (
          <button type="button" className="pill-btn play-all" onClick={playAll}>
            <Icon.play />
            {t('common.playAll')}
          </button>
        )}
      </PageHeader>

      {error && (
        <p className="hint" role="alert">
          <span className="err">{error}</span>
        </p>
      )}

      {!items ? (
        <ShelfSkeleton n={8} />
      ) : !items.length ? (
        <p className="hint">{t('channels.noneYet')}</p>
      ) : (
        <>
          <p className="shelf-count">{count(items.length, items[0]?.kind === 'song' || !items[0]?.kind ? 'song' : items[0].kind)}</p>
          <StreamList items={items} />
        </>
      )}
    </>
  );
}
