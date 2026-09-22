import { useCallback, useEffect, useState } from 'react';
import { CatalogGrid, ShelfSkeleton } from '../components/Catalog.jsx';
import { Icon } from '../components/Icons.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { api } from '../lib/api.js';
import { shelfQuery, shelfTitle } from '../lib/shelves.js';
import { useUi } from '../state/ui.jsx';

export function Shelf({ id }) {
  const { t, count } = useUi();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [pulling, setPulling] = useState(false);

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

  const pull = async () => {
    setPulling(true);
    setError(null);
    try {
      await api.refreshChannels();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPulling(false);
    }
  };

  const notSaved = (items ?? []).filter((item) => !item.savedTrackId);
  const kept = (items ?? []).filter((item) => item.savedTrackId);

  return (
    <>
      <PageHeader title={t(shelfTitle(id))}>
        <button type="button" className="pill-btn ghost" onClick={pull} disabled={pulling}>
          <span className={pulling ? 'spin' : ''}>
            <Icon.repeat />
          </span>
          {t('channels.refresh')}
        </button>
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
          <p className="hint browse-hint">{t('browse.hint')}</p>
          {kept.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>{t('browse.kept')}</h2>
              </div>
              <CatalogGrid items={kept} />
            </section>
          )}
          <CatalogGrid items={notSaved} />
        </>
      )}
    </>
  );
}
