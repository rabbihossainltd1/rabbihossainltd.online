// RabbiHossainLTD Service Worker — Static Asset Cache
// Version bump here forces cache refresh on all clients
const CACHE_NAME = 'rh-static-v52';

const STATIC_ASSETS = [
  '/css/style.min.css',
  '/js/firebase-config.js',
  '/js/firebase-core.js',
  '/js/boot-auth.js',
  '/js/auth.js',
  '/js/main.js',
  '/js/service-modal.js',
  '/js/checkout.js',
  '/js/service-info.js',
  '/js/wallet.js',
  '/js/support-chat.js',
  '/js/item4gamer.js',
  '/js/reviews.js',
  '/favicon.ico',
];

// Install: pre-cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: stale-while-revalidate for static assets, network-first for HTML
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept Firebase, backend API, or non-GET requests
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('firestore.googleapis.com')) return;
  if (url.hostname.includes('firebase')) return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('gstatic.com')) return;
  if (url.hostname.includes('up.railway.app')) return;
  if (url.hostname.includes('onrender.com')) return;
  if (url.hostname.includes('formspree.io')) return;

  // For same-origin CSS, JS, images: cache-first
  if (url.origin === self.location.origin) {
    const isCacheable =
      url.pathname.startsWith('/css/') ||
      url.pathname.startsWith('/js/') ||
      url.pathname.startsWith('/images/') ||
      url.pathname === '/favicon.ico';

    if (isCacheable) {
      event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
          const cached = await cache.match(event.request);
          const refresh = fetch(event.request).then((response) => {
            if (response && response.status === 200) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached);

          return cached || refresh;
        })
      );
      return;
    }
  }

  // For HTML pages: network-first (always fresh), fallback to cache
  if (
    event.request.headers.get('accept') &&
    event.request.headers.get('accept').includes('text/html')
  ) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request)
      )
    );
  }
});
