// Bump this to invalidate old caches when SW updates
const CACHE_VERSION = 'v3';
const APP_OFFLINE_FALLBACK = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll([APP_OFFLINE_FALLBACK]).catch(() => undefined))
      .then(() => self.skipWaiting())
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
  const url = new URL(req.url);

  // Never cache Next.js dev/build assets or HMR
  const isNextAsset = url.pathname.startsWith('/_next/') || url.pathname.startsWith('/__nextjs_original-stack-frame');
  if (isNextAsset) {
    return; // allow default network behavior
  }

  // Navigation: network-first, do not cache HTML (prevents stale UI)
  if (isNavigationRequest(event)) {
    event.respondWith(
      fetch(req).catch(() => caches.match(APP_OFFLINE_FALLBACK))
    );
    return;
  }

  // Static assets in /public (images/icons): cache-first with background update
  if (req.method === 'GET' && url.origin === self.location.origin) {
    // Only cache paths under known static folders
    const cacheable = url.pathname.startsWith('/icons/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.webp');
    if (!cacheable) return; // bypass caching for other resources

    event.respondWith(
      caches.match(req).then((cached) => {
        const networkPromise = fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone)).catch(() => { });
          return res;
        }).catch(() => cached);
        return cached || networkPromise;
      })
    );
  }
});
