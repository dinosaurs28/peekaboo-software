const CACHE_VERSION = 'v1';
const APP_SHELL = [
  '/',
  '/dashboard',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_VERSION ? caches.delete(k) : Promise.resolve()))).then(() => self.clients.claim())
  );
});

function isNavigationRequest(event) {
  return event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Navigation: network-first with cache fallback to offline page
  if (isNavigationRequest(event)) {
    event.respondWith(
      fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone)).catch(() => { });
        return res;
      }).catch(() => caches.match(req)).then((cached) => cached || caches.match('/offline.html'))
    );
    return;
  }
  // Static assets: cache-first for same-origin GET requests
  if (req.method === 'GET' && new URL(req.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone)).catch(() => { });
        return res;
      }))
    );
  }
});
