import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

/**
 * Who is listening. Laxan is open to whoever reaches it over the Wi-Fi until the first
 * account exists; from then on every shelf, playlist and play belongs to somebody.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState(0);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.me();
      setUser(res?.user ?? null);
      setAccounts(res?.accounts ?? 0);
    } catch {
      /* Offline or signed out: the last known listener keeps the screen steady. */
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const attempt = useCallback(async (fn) => {
    setBusy(true);
    setErrorCode(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setErrorCode(err.code && String(err.code).includes('-') ? err.code : 'failed');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const signUp = useCallback(
    (details) =>
      attempt(async () => {
        const res = await api.signUp(details);
        setUser(res.user);
        setAccounts(1);
      }),
    [attempt]
  );

  const logIn = useCallback(
    (email, password) =>
      attempt(async () => {
        const res = await api.logIn(email, password);
        setUser(res.user);
      }),
    [attempt]
  );

  const logOut = useCallback(
    () =>
      attempt(async () => {
        await api.logOut();
        setUser(null);
      }),
    [attempt]
  );

  const saveInterests = useCallback(
    (list) =>
      attempt(async () => {
        const res = await api.saveInterests(list);
        setUser(res.user);
      }),
    [attempt]
  );

  const value = useMemo(
    () => ({
      user,
      accounts,
      checked,
      busy,
      errorCode,
      setErrorCode,
      refresh,
      signUp,
      logIn,
      logOut,
      saveInterests,
      locked: accounts > 0,
      signedIn: accounts === 0 || Boolean(user),
    }),
    [user, accounts, checked, busy, errorCode, refresh, signUp, logIn, logOut, saveInterests]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
