import { bytes, longDuration } from '../lib/format.js';
import { Icon } from './Icons.jsx';
import { Logo } from './Logo.jsx';
import { useLibrary } from '../state/library.jsx';
import { useUi } from '../state/ui.jsx';

export const NAV = [
  { to: '/home', key: 'nav.home', icon: 'library', mobile: 'nav.home' },
  { to: '/songs', key: 'nav.songs', icon: 'song', mobile: 'nav.songs' },
  { to: '/talks', key: 'nav.talks', icon: 'mic', mobile: 'nav.tab.talks' },
  { to: '/channels', key: 'nav.channels', icon: 'channel', mobile: 'nav.tab.channels' },
  { to: '/artists', key: 'nav.artists', icon: 'artist' },
  { to: '/albums', key: 'nav.albums', icon: 'disc' },
  { to: '/playlists', key: 'nav.playlists', tab: 'nav.tab.playlists', icon: 'playlist' },
  { to: '/search', key: 'nav.search', icon: 'search', mobile: 'nav.tab.search' },
];

function useActive() {
  const { route } = useUi();
  return route.split('/')[1] || 'home';
}

export function Sidebar() {
  const { t, lang, count } = useUi();
  const active = useActive();
  const { health } = useLibrary();
  const songs = health?.stats?.songs ?? 0;

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
            {t('home.stats', { songs: count(songs, 'song'), time: longDuration(health.stats.music_seconds ?? 0, lang), size: bytes(health.stats.bytes ?? 0) })}
          </>
        )}
      </div>
    </aside>
  );
}

export function Tabbar() {
  const { t } = useUi();
  const active = useActive();
  const items = NAV.filter((n) => n.mobile);

  return (
    <nav className="tabbar">
      {items.map((item) => {
        const Glyph = Icon[item.icon];
        return (
          <a key={item.to} href={`#${item.to}`} className={active === item.to.slice(1) ? 'active' : ''}>
            <Glyph />
            {t(item.mobile)}
          </a>
        );
      })}
    </nav>
  );
}

export function PageHeader({ title, children }) {
  const { t, lang, setLang, theme, setTheme } = useUi();

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
      <button type="button" className="icon-btn" onClick={() => setLang(lang === 'so' ? 'en' : 'so')} aria-label={t('settings.language')} title={t('settings.language')}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '-0.01em' }}>{lang === 'so' ? 'EN' : 'SO'}</span>
      </button>
      <a className="icon-btn" href="#/settings" aria-label={t('nav.settings')}>
        <Icon.settings />
      </a>
    </header>
  );
}
