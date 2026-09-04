// Test fixture: a minimal root-scope worker, standing in for a stale
// mock backend worker. Installs, claims immediately, passes everything
// through untouched. Used by test/specs/sw-stale.spec.mjs only.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));
