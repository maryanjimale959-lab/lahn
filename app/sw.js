/* The minimum a browser needs to offer "Download Laxan": a worker that answers navigations. It
   caches nothing on purpose — an installed copy still asks the same server for every item, so a
   phone on her Wi-Fi behaves exactly like a tab, and a phone on the preview plays only what the
   preview carries. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request));
});
