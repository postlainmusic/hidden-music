// Minimal Service Worker to satisfy Chrome PWA install criteria
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through fetch without aggressive caching
  event.respondWith(fetch(event.request));
});
