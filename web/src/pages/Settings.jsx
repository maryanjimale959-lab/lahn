import { useState } from 'react';
import { api } from '../lib/api.js';
import { bytes, longDuration } from '../lib/format.js';
import { Icon } from '../components/Icons.jsx';
import { LogoMark } from '../components/Logo.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

const THEMES = ['light', 'dark', 'system'];

function Row({ label, hint, children }) {
  return (
    <div className="set-row">
      <div className="set-label">
        <b>{label}</b>
        {hint && <span>{hint}</span>}
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="set-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function Settings() {
  const { t, lang, count, setLang, theme, setTheme } = useUi();
  const { health, stats, refresh } = useLibrary();
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState(null);

  const scan = async () => {
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await api.scan();
      setScanMsg(`+${res.added} −${res.removed}`);
      await refresh();
    } catch (err) {
      setScanMsg(err.message);
    } finally {
      setScanning(false);
    }
  };

  const missing = health?.missing ?? [];
  const engine = health?.tools ?? {};

  return (
    <>
      <PageHeader title={t('settings.title')} />

      <Group title={t('settings.appearance')}>
        <Row label={t('settings.theme')}>
          <div className="seg">
            {THEMES.map((value) => (
              <button key={value} type="button" className={theme === value ? 'on' : ''} onClick={() => setTheme(value)}>
                {value === 'light' && <Icon.sun />}
                {value === 'dark' && <Icon.moon />}
                {value === 'system' && <Icon.spark />}
                {t(`settings.theme.${value}`)}
              </button>
            ))}
          </div>
        </Row>
        <Row label={t('settings.language')}>
          <div className="seg">
            <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
              English
            </button>
            <button type="button" className={lang === 'so' ? 'on' : ''} onClick={() => setLang('so')}>
              Soomaali
            </button>
          </div>
        </Row>
      </Group>

      <Group title={t('settings.group.library')}>
        <Row label={t('settings.libraryFolder')} hint={<bdi dir="ltr">{health?.libraryDir}</bdi>}>
          <span className="mono-value">{count(stats?.songs ?? 0, 'song')} · {longDuration(stats?.music_seconds ?? 0, lang)} · {bytes(stats?.bytes ?? 0)}</span>
        </Row>
        <Row label={t('settings.scan')}>
          <button type="button" className="pill-btn ghost" onClick={scan} disabled={scanning}>
            <Icon.folder />
            {scanning ? '…' : t('settings.rescan')}
          </button>
        </Row>
        {scanMsg && <p className="hint">{t('settings.scanDone')}: {scanMsg}</p>}
        <p className="hint">{t('settings.libraryHint')}</p>
      </Group>

      <Group title={t('settings.tools')}>
        {missing.length === 0 ? (
          <Row label={t('settings.engineOk')}>
            <span className="badge ok">
              <Icon.check />
              OK
            </span>
          </Row>
        ) : (
          <Row label={t('settings.engineMissing')}>
            <span className="badge bad">{missing.join(', ')}</span>
          </Row>
        )}
        <div className="engine-lines">
          <p className="mono-value small">
            <span className="tool">yt-dlp</span>
            <bdi dir="ltr">{engine.ytdlp ?? '—'}</bdi>
          </p>
          <p className="mono-value small">
            <span className="tool">ffmpeg</span>
            <bdi dir="ltr">{engine.ffmpeg ?? '—'}</bdi>
          </p>
        </div>
      </Group>

      <Group title={t('settings.phone')}>
        <Row label={t('settings.phoneSameWifi')} hint={t('settings.phoneHint')}>
          <div className="lan-list">
            {(health?.lan ?? []).map((net) => (
              <a key={net.address} href={`http://${net.address}:${health.port}`} target="_blank" rel="noreferrer" dir="ltr">
                <Icon.wifi />
                {`${net.address}:${health.port}`}
              </a>
            ))}
            {!health?.lan?.length && <span className="hint">—</span>}
          </div>
        </Row>
      </Group>

      <Group title={t('settings.about')}>
        <div className="about">
          <LogoMark size={64} spin />
          <div>
            <b>Lahn</b>
            <span>
              {t('app.tagline')} — {t('settings.version')} {health?.version ?? '—'}
            </span>
            <span className="credit">{t('settings.createdBy')}</span>
            <span className="hint">{t('settings.privacy')}</span>
          </div>
        </div>
      </Group>
    </>
  );
}
