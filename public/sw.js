/**
 * Service Worker for Hidden Music Vault (postlain.com)
 * -----------------------------------------------------
 * Features:
 * 1. Network-first strategy with cache fallback for static app assets & UI.
 * 2. Bypass cache for Range Request media streams (HTTP 206 Partial Content) to prevent audio seek glitches.
 * 3. Background Sync & Audio Focus Support.
 */

const CACHE_NAME = 'hidden-music-vault-v1.0';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
];

// Install: Cache essential shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never cache Audio/Video stream chunks or Range Requests
  if (
    request.headers.get('range') ||
    url.pathname.startsWith('/api/stream') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.flac') ||
    url.pathname.endsWith('.wav') ||
    url.pathname.endsWith('.mp4') ||
    url.hostname.includes('r2.cloudflarestorage.com') ||
    url.hostname.includes('r2.dev')
  ) {
    return; // Pass through straight to network
  }

  // 2. Navigation / Page / Static Asset Requests
  if (request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (request.mode === 'navigate') {
              return caches.match('/');
            }
          });
        })
    );
  }
});
