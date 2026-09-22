import '@fontsource-variable/manrope';
import './styles/base.css';
import './styles/player.css';
import './styles/ui.css';
import './styles/shelf.css';

import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { LibraryProvider } from './state/library.jsx';
import { PlayerProvider } from './state/player.jsx';
import { UiProvider } from './state/ui.jsx';

createRoot(document.getElementById('root')).render(
  <UiProvider>
    <PlayerProvider>
      <LibraryProvider>
        <App />
      </LibraryProvider>
    </PlayerProvider>
  </UiProvider>
);
