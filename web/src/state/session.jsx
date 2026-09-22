import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, watchSession } from '../lib/api.js';
import { thisDevice } from '../lib/device.js';

export const SessionContext = createContext(null);

/**
 * The now-playing session is shared by every screen in the house. Whoever last
 * pressed something owns it; the others mirror it until they take over.
 */
/** Another screen is driving only if it holds a track; an empty session is nobody's. */
const isRemote = (session, id) => Boolean(session?.trackId) && session.device?.id && session.device.id !== id ? session : null;

export function SessionProvider({ children }) {
  const device = useMemo(thisDevice, []);
  const [remote, setRemote] = useState(null);

  useEffect(() => {
    const close = watchSession((next) => setRemote(isRemote(next, device.id)));
    api
      .session()
      .then((res) => setRemote(isRemote(res?.session, device.id)))
      .catch(() => {});
    return close;
  }, [device.id]);

  const publish = useCallback(
    (session) => {
      setRemote(null);
      return api.saveSession(device, session).catch(() => {});
    },
    [device]
  );

  const value = useMemo(() => ({ device, remote, publish }), [device, remote, publish]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
