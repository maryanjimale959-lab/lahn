import { bytes, longDuration } from '../lib/format.js';
import { Icon } from './Icons.jsx';
import { Logo } from './Logo.jsx';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

export const NAV = [
  { to: '/home', key: 'nav.home', icon: 'library' },
  { to: '/songs', key: 'nav.songs', icon: 'song' },
  { to: '/artists', key: 'nav.artists', icon: 'artist' },
  { to: '/albums', key: 'nav.albums', icon: 'disc' },
  { to: '/playlists', key: 'nav.playlists', tab: 'nav.tab.playlists', icon: 'playlist' },
  { to: '/search', key: 'nav.search', icon: 'search' },
];

function useActive() {
  const { route } = useUi();
  return route.split('/')[1] || 'home';
}

export function Sidebar() {
  const { t, lang, count } = useUi();
  const active = useActive();
  const { health } = useLibrary();
  const songs = health?.stats?.tracks ?? 0;

  return (
    <aside className="sidebar">
      <div className="brand">
        <Logo />
      </div>
      <nav className="nav">
        {NAV.map((item) => {
          const Glyph = Icon[item.icon];
          return (
            <a key={item.to} href={`#${item.to}`} className={active === item.to.slice(1) ? 'active' : ''}>
              <Glyph />
              {t(item.key)}
            </a>
          );
        })}
      </nav>
      <div className="side-note">
        <b>{t('settings.library')}</b>
        {t('settings.libraryHint')}
        {songs > 0 && (
          <>
            <br />
            <br />
            {t('home.stats', { songs: count(songs, 'song'), time: longDuration(health.stats.seconds ?? 0, lang), size: bytes(health.stats.bytes ?? 0, lang) })}
          </>
        )}
      </div>
    </aside>
  );
}

export function Tabbar() {
  const { t } = useUi();
  const active = useActive();
  const items = NAV.filter((n) => n.to !== '/albums');

  return (
    <nav className="tabbar">
      {items.map((item) => {
        const Glyph = Icon[item.icon];
        return (
          <a key={item.to} href={`#${item.to}`} className={active === item.to.slice(1) ? 'active' : ''}>
            <Glyph />
            {t(item.tab ?? item.key)}
          </a>
        );
      })}
    </nav>
  );
}

export function PageHeader({ title, children }) {
  const { t, lang, setLang, theme, setTheme } = useUi();
  const { setAddOpen } = useLibrary();

  const nextTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  const ThemeIcon = theme === 'dark' ? Icon.moon : theme === 'light' ? Icon.sun : Icon.spark;

  return (
    <header className="topbar">
      <h1>{title}</h1>
      <span className="spacer" />
      {children}
      <button type="button" className="icon-btn theme-btn" onClick={() => setTheme(nextTheme)} title={`${t('settings.theme')}: ${t(`settings.theme.${theme}`)}`} aria-label={t('settings.theme')}>
        <ThemeIcon />
      </button>
      <button type="button" className="icon-btn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label={t('settings.language')} title={t('settings.language')}>
        <span style={{ fontSize: lang === 'ar' ? 13 : 12, fontWeight: 800, letterSpacing: '-0.01em' }}>{lang === 'ar' ? 'EN' : 'عربي'}</span>
      </button>
      <button type="button" className="pill-btn" onClick={() => setAddOpen(true)}>
        <Icon.plus />
        <span className="add-label">{t('add.title')}</span>
      </button>
      <a className="icon-btn" href="#/settings" aria-label={t('nav.settings')}>
        <Icon.settings />
      </a>
    </header>
  );
}
