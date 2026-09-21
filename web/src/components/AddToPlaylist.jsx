import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Icon } from './Icons.jsx';
import { useUi } from '../state/ui.jsx';
import { useLibrary } from '../state/library.jsx';

export function AddToPlaylist({ trackIds, label, className = 'chip', children }) {
  const { t } = useUi();
  const { playlists, refresh } = useLibrary();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const ids = Array.isArray(trackIds) ? trackIds : [trackIds];

  const put = async (playlistId) => {
    setBusy(true);
    try {
      await api.addToPlaylist(playlistId, ids);
      setFlash(playlistId);
      setTimeout(() => setFlash(null), 1400);
      refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const name = window.prompt(t('playlists.namePrompt'), '');
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const { playlist } = await api.createPlaylist(name.trim());
      await api.addToPlaylist(playlist.id, ids);
      await refresh();
      setOpen(false);
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="menu-root" ref={root} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={label ?? t('player.addToPlaylist')}
        title={label ?? t('player.addToPlaylist')}
      >
        {children ?? (
          <>
            <Icon.plus />
            <span className="chip-label">{label ?? t('player.addToPlaylist')}</span>
          </>
        )}
      </button>
      {open && (
        <div className="menu" role="menu">
          {playlists?.length ? (
            playlists.map((pl) => (
              <button key={pl.id} type="button" role="menuitem" disabled={busy} onClick={() => put(pl.id)}>
                <span>{pl.name}</span>
                <em>{pl.track_count}</em>
                {flash === pl.id && <Icon.check className="tick" />}
              </button>
            ))
          ) : (
            <p className="menu-empty">{t('playlists.empty')}</p>
          )}
          <button type="button" className="menu-new" role="menuitem" disabled={busy} onClick={create}>
            <Icon.plus />
            {t('playlists.new')}
          </button>
        </div>
      )}
    </span>
  );
}
