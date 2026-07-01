const CACHE_NAME = 'budgetapp-v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_QUEUE_SIZE = 100;

// App shell files to cache
const APP_SHELL = ['/', '/dashboard', '/accounts', '/transactions', '/budget', '/settings'];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for app shell
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.url.includes('/api/')) {
    // Network-first for API calls, cache response for offline
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (request.method === 'GET' && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // Cache-first for app shell
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
