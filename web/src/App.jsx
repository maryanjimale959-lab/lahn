import { useEffect, useState } from 'react';
import { useAmbientGlow } from './components/Art.jsx';
import { MiniPlayer } from './components/MiniPlayer.jsx';
import { Elsewhere } from './components/Elsewhere.jsx';
import { NowPlaying } from './components/NowPlaying.jsx';
import { Sidebar, Tabbar } from './components/Shell.jsx';
import { Albums, Artists, Songs } from './pages/Browse.jsx';
import { ChannelPage, Channels } from './pages/Channels.jsx';
import { AlbumPage, ArtistPage, PlaylistPage, Playlists } from './pages/Collections.jsx';
import { Home } from './pages/Home.jsx';
import { Shelf } from './pages/Shelf.jsx';
import { Talks } from './pages/Talks.jsx';
import { Search } from './pages/Search.jsx';
import { Settings } from './pages/Settings.jsx';
import { Welcome } from './pages/Welcome.jsx';
import { useAuth } from './state/auth.jsx';
import { LibraryProvider, useLibrary } from './state/library.jsx';
import { PlayerProvider, usePlayer } from './state/player.jsx';
import { SessionProvider, useSession } from './state/session.jsx';
import { parseRoute, useUi } from './state/ui.jsx';

function CurrentPage({ section, id }) {
  if (id) {
    if (section === 'artists') return <ArtistPage id={id} />;
    if (section === 'albums') return <AlbumPage id={id} />;
    if (section === 'playlists') return <PlaylistPage id={id} />;
    if (section === 'channels') return <ChannelPage id={id} />;
    if (section === 'shelf') return <Shelf id={id} />;
  }
  switch (section) {
    case 'songs':
      return <Songs />;
    case 'talks':
      return <Talks kind={id} />;
    case 'channels':
      return <Channels />;
    case 'artists':
      return <Artists />;
    case 'albums':
      return <Albums />;
    case 'playlists':
      return <Playlists />;
    case 'search':
      return <Search />;
    case 'settings':
      return <Settings />;
    default:
      return <Home />;
  }
}

export function App() {
  const { route, t, navigate } = useUi();
  const { offline } = useLibrary();
  const { current } = usePlayer();
  const { remote } = useSession();
  const [playerOpen, setPlayerOpen] = useState(false);
  const { section, id } = parseRoute(route);

  useAmbientGlow(current?.cover, current?.title ?? 'lahn');

  useEffect(() => {
    if (section !== 'now') return;
    setPlayerOpen(true);
    navigate('/home');
  }, [navigate, section]);

  return (
    <div className="app">
      {offline && (
        <div className="offline-bar" role="status">
          {t('common.offline')}
        </div>
      )}
      <div className="shell">
        <Sidebar />
        <main className="main">
          <CurrentPage section={section} id={id} />
        </main>
      </div>

      <Tabbar />

      {remote && !playerOpen && <Elsewhere onTakeOver={() => setPlayerOpen(true)} />}
      {!remote && current && !playerOpen && <MiniPlayer onOpen={() => setPlayerOpen(true)} />}
      {playerOpen && <NowPlaying onClose={() => setPlayerOpen(false)} />}
    </div>
  );
}

/**
 * Nobody fetches library data before they are in, so a signed-out phone never sees a
 * wall of 401s — it sees the door. Someone with an account and no interests is still
 * at the door too: the picker is part of getting in, not a page they can lose.
 */
export function Gate() {
  const { checked, signedIn, user, accounts } = useAuth();
  const needsInterests = accounts > 0 && Boolean(user) && !user.interests?.length;
  if (!checked) {
    return (
      <div className="splash">
        <span className="welcome-mark">Laxan</span>
      </div>
    );
  }
  if (!signedIn || needsInterests) return <Welcome />;
  return (
    <SessionProvider>
      <PlayerProvider>
        <LibraryProvider>
          <App />
        </LibraryProvider>
      </PlayerProvider>
    </SessionProvider>
  );
}
