import { useEffect, useState } from 'react';
import { AddSheet } from './components/AddSheet.jsx';
import { useAmbientGlow } from './components/Art.jsx';
import { MiniPlayer } from './components/MiniPlayer.jsx';
import { NowPlaying } from './components/NowPlaying.jsx';
import { Sidebar, Tabbar } from './components/Shell.jsx';
import { Albums, Artists, Songs } from './pages/Browse.jsx';
import { AlbumPage, ArtistPage, PlaylistPage, Playlists } from './pages/Collections.jsx';
import { Home } from './pages/Home.jsx';
import { Search } from './pages/Search.jsx';
import { Settings } from './pages/Settings.jsx';
import { useLibrary } from './state/library.jsx';
import { usePlayer } from './state/player.jsx';
import { parseRoute, useUi } from './state/ui.jsx';

function CurrentPage({ section, id }) {
  if (id) {
    if (section === 'artists') return <ArtistPage id={id} />;
    if (section === 'albums') return <AlbumPage id={id} />;
    if (section === 'playlists') return <PlaylistPage id={id} />;
  }
  switch (section) {
    case 'songs':
      return <Songs />;
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
  const { addOpen, setAddOpen, offline } = useLibrary();
  const { current } = usePlayer();
  const [playerOpen, setPlayerOpen] = useState(false);
  const { section, id } = parseRoute(route);

  useAmbientGlow(current?.cover, current?.title ?? 'lahn');

  useEffect(() => {
    if (window.location.search.includes('add=1')) {
      setAddOpen(true);
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, [setAddOpen]);

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

      {current && !playerOpen && <MiniPlayer onOpen={() => setPlayerOpen(true)} />}
      {playerOpen && <NowPlaying onClose={() => setPlayerOpen(false)} />}
      {addOpen && <AddSheet />}
    </div>
  );
}
