import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icons.jsx';
import { LogoMark } from '../components/Logo.jsx';
import { PageHeader } from '../components/Shell.jsx';
import { INTEREST_ART } from '../lib/kinds.js';
import { shelfTitle } from '../lib/shelves.js';
import { useAuth } from '../state/auth.jsx';
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

/** Her name, what she is into, and the way out. Only once there is an account to show. */
function Account() {
  const { t, navigate } = useUi();
  const { user, saveInterests, logOut, refresh } = useAuth();
  const [known, setKnown] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.interests().then((res) => setKnown(res?.interests ?? [])).catch(() => {});
  }, []);

  if (!user) return null;

  const picked = user.interests ?? [];
  const toggle = (id) => saveInterests(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  const leave = async () => {
    setBusy(true);
    await logOut();
    setBusy(false);
    navigate('/home');
  };

  const drop = async () => {
    if (!confirm) return setConfirm(true);
    setBusy(true);
    await api.deleteAccount().catch(() => {});
    await refresh();
    setBusy(false);
    navigate('/home');
  };

  return (
    <Group title={t('settings.account')}>
      <Row label={t('auth.name')} hint={user.email}>
        <div className="account-name">
          <span className="account-chip">
            <LogoMark size={26} />
            {user.name}
          </span>
          <button type="button" className="pill-btn ghost" onClick={leave} disabled={busy}>
            <Icon.back />
            {t('auth.signOut')}
          </button>
        </div>
      </Row>
      <Row label={t('auth.interestsTitle')} hint={t('settings.interestsHint')}>
        <div className="interest-list">
          {known.map((item) => {
            const Glyph = Icon[INTEREST_ART[item.id]] ?? Icon.song;
            const on = picked.includes(item.id);
            return (
              <button key={item.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(item.id)}>
                <Glyph />
                {t(shelfTitle(item.id))}
              </button>
            );
          })}
        </div>
      </Row>
      <Row label={t('settings.deleteAccount')} hint={confirm ? t('settings.deleteWarning') : t('settings.deleteHint')}>
        <button type="button" className={`pill-btn ${confirm ? 'danger' : 'ghost'}`} onClick={drop} disabled={busy}>
          <Icon.trash />
          {confirm ? t('settings.deleteConfirm') : t('settings.deleteAccount')}
        </button>
      </Row>
    </Group>
  );
}

export function Settings() {
  const { t, lang, setLang, theme, setTheme } = useUi();
  const { health, refresh } = useLibrary();
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

      <Account />

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
          <button type="button" className="pill-btn ghost" onClick={scan} disabled={scanning}>
            <Icon.folder />
            {scanning ? '…' : t('settings.rescan')}
          </button>
        </Row>
        {scanMsg && <p className="hint">{t('settings.scanDone')}: {scanMsg}</p>}
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

      <p className="settings-foot">
        <LogoMark size={22} />
        <span>
          Laxan {health?.version ?? ''} · {t('settings.privacy')}
        </span>
      </p>
    </>
  );
}
