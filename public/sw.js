// ==========================================================================
// Service Worker — Estudio Personal
// La app se guarda completa en el dispositivo para abrirse al instante,
// aunque no haya Internet. Los datos NO pasan por aquí: viven en
// IndexedDB (js/offline.js) y se sincronizan con tu repositorio de GitHub.
// ==========================================================================
const VERSION = 'v3.3.3';
const SHELL_CACHE = `ep-shell-${VERSION}`;
const RUNTIME_CACHE = 'ep-runtime-v1';

const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/engine.js',
  'js/bible.js',
  'js/offline.js',
  'js/app-shell.js',
  'js/sound.js',
  'js/rosco.js',
  'js/game.js',
  'js/notes.js',
  'js/wol-assistant.js',
  'css/wol-assistant.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'manifest.json'
];

const scopeUrl = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => Promise.all(SHELL.map(p =>
        cache.add(new Request(scopeUrl(p), { cache: 'reload' })).catch(err => console.warn('[SW] No se pudo guardar', p, err))
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('ep-shell-') && k !== SHELL_CACHE || k.startsWith('estudio-personal-'))
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isApi(url) {
  return url.pathname.includes('/api/');
}

// Devuelve la copia guardada al momento y la actualiza en segundo plano
function staleWhileRevalidate(request, cacheName, fallbackKey) {
  return caches.open(cacheName).then(async cache => {
    const cached = await cache.match(fallbackKey || request, { ignoreSearch: true });
    const network = fetch(request)
      .then(res => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(fallbackKey || request, res.clone());
        return res;
      })
      .catch(() => null);
    if (cached) return cached;
    const res = await network;
    if (res) return res;
    return new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Las peticiones a la API nunca se guardan en caché
  if (isApi(url)) return;

  // Navegación: siempre abrir la app guardada (index.html)
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    const isSubPage = /reyes-memorizador\//.test(url.pathname);
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE, isSubPage ? undefined : scopeUrl('index.html')));
    return;
  }

  // Archivos propios de la app
  if (url.origin === self.location.origin) {
    const bare = url.origin + url.pathname; // sin "?v=..." para reutilizar la copia guardada
    const inShell = SHELL.some(p => bare === scopeUrl(p));
    event.respondWith(staleWhileRevalidate(request, inShell ? SHELL_CACHE : RUNTIME_CACHE, inShell ? bare : undefined));
    return;
  }

  // Fuentes de Google: guardarlas para usarlas sin conexión
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
