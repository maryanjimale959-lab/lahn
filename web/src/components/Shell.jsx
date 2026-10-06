import { Icon } from './Icons.jsx';
import { Logo } from './Logo.jsx';
import { DEMO } from '../lib/api.js';
import { useUi } from '../state/ui.jsx';

/** Primary rooms — always in the rail and on the phone. */
export const NAV = [
  { to: '/home', key: 'nav.home', icon: 'library', mobile: 'nav.home', group: 'listen' },
  { to: '/search', key: 'nav.search', icon: 'search', mobile: 'nav.tab.search', group: 'listen' },
  { to: '/songs', key: 'nav.songs', icon: 'song', mobile: 'nav.songs', group: 'listen' },
  { to: '/talks', key: 'nav.talks', icon: 'mic', mobile: 'nav.tab.talks', group: 'listen' },
  { to: '/shelf/quran', key: 'shelf.quran', icon: 'spark', group: 'listen' },
  { to: '/channels', key: 'nav.channels', icon: 'channel', mobile: 'nav.tab.channels', group: 'listen' },
  { to: '/artists', key: 'nav.artists', icon: 'artist', group: 'library' },
  { to: '/albums', key: 'nav.albums', icon: 'disc', group: 'library' },
  { to: '/playlists', key: 'nav.playlists', tab: 'nav.tab.playlists', icon: 'playlist', group: 'library', mobile: 'nav.tab.playlists' },
];

const LIBRARY_ROOMS = new Set(['/songs', '/artists', '/albums', '/playlists']);
const navFor = (demo) => NAV.filter((item) => !(demo && LIBRARY_ROOMS.has(item.to)));

function useActive() {
  const { route } = useUi();
  return route.replace(/^\//, '');
}

function isActive(active, to) {
  const path = to.slice(1);
  if (active === path) return true;
  if (path === 'talks' && active.startsWith('talks')) return true;
  if (path === 'shelf/quran' && active.startsWith('shelf/quran')) return true;
  return false;
}

export function Sidebar() {
  const { t } = useUi();
  const active = useActive();
  const items = navFor(DEMO);
  const listen = items.filter((i) => i.group === 'listen');
  const library = items.filter((i) => i.group === 'library');

  return (
    <aside className="sidebar">
      <div className="side-panel">
        <div className="brand">
          <Logo size={40} />
        </div>

        <nav className="nav" aria-label={t('nav.home')}>
          <p className="nav-label">{t('nav.listen')}</p>
          {listen.map((item) => {
            const Glyph = Icon[item.icon];
            return (
              <a key={item.to} href={`#${item.to}`} className={isActive(active, item.to) ? 'active' : ''}>
                <Glyph />
                {t(item.key)}
              </a>
            );
          })}

          {library.length > 0 && (
            <>
              <p className="nav-label">{t('nav.yours')}</p>
              {library.map((item) => {
                const Glyph = Icon[item.icon];
                return (
                  <a key={item.to} href={`#${item.to}`} className={isActive(active, item.to) ? 'active' : ''}>
                    <Glyph />
                    {t(item.key)}
                  </a>
                );
              })}
            </>
          )}
        </nav>

        <a className="side-settings" href="#/settings">
          <Icon.settings />
          {t('nav.settings')}
        </a>
      </div>
    </aside>
  );
}

export function Tabbar() {
  const { t } = useUi();
  const active = useActive();
  const items = navFor(DEMO).filter((n) => n.mobile);

  return (
    <nav className="tabbar">
      {items.map((item) => {
        const Glyph = Icon[item.icon];
        return (
          <a key={item.to} href={`#${item.to}`} className={isActive(active, item.to) ? 'active' : ''}>
            <Glyph />
            {t(item.mobile)}
          </a>
        );
      })}
    </nav>
  );
}

export function PageHeader({ title, children, kicker }) {
  const { t, lang, setLang, theme, setTheme } = useUi();

  const nextTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  const ThemeIcon = theme === 'dark' ? Icon.moon : theme === 'light' ? Icon.sun : Icon.spark;

  return (
    <header className="topbar">
      <div className="topbar-title">
        {kicker && <span className="topbar-kicker">{kicker}</span>}
        <h1>{title}</h1>
      </div>
      <span className="spacer" />
      {children}
      <button type="button" className="icon-btn theme-btn" onClick={() => setTheme(nextTheme)} title={`${t('settings.theme')}: ${t(`settings.theme.${theme}`)}`} aria-label={t('settings.theme')}>
        <ThemeIcon />
      </button>
      <button type="button" className="icon-btn" onClick={() => setLang(lang === 'so' ? 'en' : 'so')} aria-label={t('settings.language')} title={t('settings.language')}>
        <span className="lang-pill">{lang === 'so' ? 'EN' : 'SO'}</span>
      </button>
      <a className="icon-btn mobile-only-settings" href="#/settings" aria-label={t('nav.settings')}>
        <Icon.settings />
      </a>
    </header>
  );
}
