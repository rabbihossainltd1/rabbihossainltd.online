// RabbiHossainLTD Service Worker — Static Asset Cache
// Version bump here forces cache refresh on all clients
const CACHE_NAME = 'rh-static-v72';

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
  '/js/order-success.js',
  '/favicon.ico',
];

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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('firestore.googleapis.com')) return;
  if (url.hostname.includes('firebase')) return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('gstatic.com')) return;
  if (url.hostname.includes('up.railway.app')) return;
  if (url.hostname.includes('onrender.com')) return;
  if (url.hostname.includes('formspree.io')) return;

  if (url.origin === self.location.origin) {
    const isJs = url.pathname.startsWith('/js/');
    const isHtmlLike =
      event.request.headers.get('accept') &&
      event.request.headers.get('accept').includes('text/html');

    // JS + HTML: always network-first so order-success / checkout JS is not stale.
    if (isJs || isHtmlLike) {
      event.respondWith(
        fetch(event.request, { cache: 'no-store' }).then((response) => {
          if (response && response.status === 200 && isJs) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone())).catch(() => {});
          }
          return response;
        }).catch(() => caches.match(event.request))
      );
      return;
    }

    const isCacheable =
      url.pathname.startsWith('/css/') ||
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
    }
  }
});
