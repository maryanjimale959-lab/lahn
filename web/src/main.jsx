import '@fontsource-variable/manrope';
import './styles/base.css';
import './styles/player.css';
import './styles/ui.css';
import './styles/shelf.css';
import './styles/welcome.css';

import { createRoot } from 'react-dom/client';
import { Gate } from './App.jsx';
import { AuthProvider } from './state/auth.jsx';
import { UiProvider } from './state/ui.jsx';

createRoot(document.getElementById('root')).render(
  <UiProvider>
    <AuthProvider>
      <Gate />
    </AuthProvider>
  </UiProvider>
);

/* Without a worker on the page no browser offers to install Laxan, phone or desktop. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
