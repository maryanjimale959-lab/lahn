import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { applyDir, loadLang, plural, saveLang, translate } from '../lib/i18n.js';

const UiContext = createContext(null);

const THEME_KEY = 'lahn.theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function readRoute() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash.startsWith('/') ? hash : '/';
}

export function UiProvider({ children }) {
  const [lang, setLangState] = useState(loadLang);
  const [theme, setThemeState] = useState(() => localStorage.getItem(THEME_KEY) || 'system');
  const [systemDark, setSystemDark] = useState(media.matches);
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onChange = (e) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  }, [theme, systemDark]);

  useEffect(() => {
    applyDir(lang);
  }, [lang]);

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setLang = useCallback((next) => {
    saveLang(next);
    setLangState(next);
  }, []);

  const setTheme = useCallback((next) => {
    localStorage.setItem(THEME_KEY, next);
    setThemeState(next);
  }, []);

  const navigate = useCallback((to) => {
    const clean = to.startsWith('/') ? to : `/${to}`;
    if (readRoute() === clean) return;
    window.location.hash = clean;
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  const count = useCallback((n, key) => plural(lang, n, key), [lang]);

  const value = useMemo(
    () => ({ lang, setLang, t, count, theme, setTheme, dark: theme === 'system' ? systemDark : theme === 'dark', route, navigate }),
    [lang, setLang, t, count, theme, setTheme, systemDark, route, navigate]
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside UiProvider');
  return ctx;
}

export function parseRoute(route) {
  const parts = route.split('/').filter(Boolean);
  return { section: parts[0] || 'home', id: parts[1] || null };
}
