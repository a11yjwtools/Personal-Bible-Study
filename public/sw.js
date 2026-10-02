// Service Worker para Estudio Personal (PWA)
const CACHE_NAME = 'estudio-personal-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/sound.js',
  '/js/rosco.js',
  '/js/game.js',
  '/js/notes.js',
  '/js/wol-assistant.js',
  '/css/wol-assistant.css',
  '/icons/icon.svg',
  '/manifest.json'
];

// API routes to cache for offline support
const API_CACHE_NAME = 'estudio-personal-api-v1';
const CACHEABLE_API_ROUTES = [
  '/api/notes',
  '/api/categories',
  '/api/years'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[PWA SW] Pre-cache parcial:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Check if a URL is a cacheable API route
function isCacheableApiRoute(url) {
  return CACHEABLE_API_ROUTES.some(route => url.pathname === route);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For cacheable API routes: Network-first with cache fallback
  if (isCacheableApiRoute(url)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(API_CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) {
              console.log('[PWA SW] Serving cached API response for:', url.pathname);
              return cached;
            }
            // Return empty success response if nothing cached
            return new Response(JSON.stringify({ success: true, notes: [], categories: [], years: [] }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // For other API routes: skip caching
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For static assets: Network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/index.html');
        });
      })
  );
});
