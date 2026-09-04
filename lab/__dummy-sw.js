// Stand-in for a stale/conflicting worker: controls /lab/* with plain
// passthrough fetches (the failure mode that motivated boot assertions).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));
