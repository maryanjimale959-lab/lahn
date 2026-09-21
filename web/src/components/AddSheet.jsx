import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Icon } from './Icons.jsx';
import { Art } from './Art.jsx';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

const stageKey = { queued: 'add.probing', probing: 'add.probing', downloading: 'add.downloading', saving: 'add.saving', done: 'add.done' };

export function AddSheet({ onClose }) {
  const { t } = useUi();
  const { setAddOpen, activeJob, addLink } = useLibrary();
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const esc = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  const close = () => {
    setAddOpen(false);
    onClose?.();
  };

  const submit = async (event) => {
    event?.preventDefault();
    const link = url.trim();
    if (!link) return;
    setBusy(true);
    setError(null);
    try {
      await addLink(link);
      setUrl('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      inputRef.current?.focus();
    }
  };

  const job = activeJob;
  const percent = job?.percent ?? 0;
  const finished = job && (job.status === 'done' || job.status === 'error' || job.status === 'cancelled');

  return (
    <div className="scrim" onClick={close} role="dialog" aria-modal="true" aria-label={t('add.title')}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h2>{t('add.title')}</h2>
            <p>{t('add.subtitle')}</p>
          </div>
          <span className="spacer" />
          <button type="button" className="icon-btn" onClick={close} aria-label={t('common.cancel')}>
            <Icon.close />
          </button>
        </div>

        <form className="field" onSubmit={submit}>
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('add.placeholder')}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            dir="ltr"
          />
          <button type="button" className="icon-btn" onClick={paste} aria-label={t('add.paste')} title={t('add.paste')}>
            <Icon.link />
          </button>
          <button type="submit" className="pill-btn" disabled={busy || !url.trim()}>
            <Icon.download />
            {t('add.button')}
          </button>
        </form>

        {error && (
          <p className="job-msg" role="alert">
            <span className="err">{error}</span>
          </p>
        )}

        {!job && !error && <p className="hint" style={{ marginTop: 16 }}>{t('add.tip')}</p>}

        {job && (
          <div className={`job ${job.status === 'done' ? 'done' : ''}`}>
            <div className="job-head">
              {job.track ? (
                <Art track={job.track} />
              ) : (
                <span className="job-art" aria-hidden="true">
                  <Icon.spark />
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <b>{job.track?.title ?? job.meta?.title ?? url}</b>
                <span>{job.track?.artist ?? job.meta?.artist ?? t(stageKey[job.stage] ?? 'add.probing')}</span>
              </div>
            </div>

            {job.status !== 'done' && (
              <>
                <div className="bar">
                  <i style={{ width: `${job.stage === 'probing' || job.stage === 'queued' ? 8 : Math.max(6, percent)}%` }} />
                </div>
                <div className="job-msg">
                  <span className={job.status === 'error' ? 'err' : ''}>
                    {job.status === 'error' ? job.message : t(stageKey[job.stage] ?? 'add.probing')}
                  </span>
                  <span>
                    {job.status === 'downloading' && job.percent ? `${Math.round(job.percent)}%` : ''}
                    {job.speed ? ` · ${t('add.speed', { speed: job.speed, eta: job.eta })}` : ''}
                  </span>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {job.status === 'done' && job.track ? (
                <>
                  <button type="button" className="pill-btn ghost" onClick={() => setUrl('')}>
                    <Icon.plus />
                    {t('add.another')}
                  </button>
                  <button type="button" className="pill-btn" onClick={close}>
                    <Icon.check />
                    {t('add.close')}
                  </button>
                </>
              ) : job.status === 'error' ? (
                <>
                  <button type="button" className="pill-btn ghost" onClick={() => setUrl(job.url)}>
                    <Icon.repeat />
                    {t('add.retry')}
                  </button>
                  <button type="button" className="pill-btn" onClick={close}>
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="pill-btn ghost"
                  onClick={async () => {
                    if (finished) return close();
                    await api.cancelJob(job.id);
                  }}
                >
                  <Icon.close />
                  {t('add.cancel')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
