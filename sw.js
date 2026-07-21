// RabbiHossainLTD Service Worker — Static Asset Cache
// Version bump here forces cache refresh on all clients
const CACHE_NAME = 'rh-static-v1';

const STATIC_ASSETS = [
  '/css/style.min.css',
  '/js/firebase-core.js',
  '/js/auth.js',
  '/js/main.js',
  '/js/service-modal.js',
  '/js/service-info.js',
  '/js/wallet.js',
  '/js/support-chat.js',
  '/js/item4gamer.js',
  '/js/reviews.js',
  '/images/meta-verified.png',
  '/images/get-visa-mastercard.png',
  '/images/ff-diamond.png',
  '/images/ff-ios.png',
  '/images/ff-drip.png',
  '/images/ff-pc.png',
  '/images/chatgpt-pro.png',
  '/images/gemini-pro.png',
  '/images/canva-pro.png',
  '/images/capcut-pro.png',
  '/images/youtube-pro.png',
  '/images/Truecaller-pro.png',
  '/images/imo-pro.png',
  '/images/netflix-pro.png',
  '/images/grok-pro.png',
  '/images/pro-vpn.png',
  '/images/adobe-premier-pro.png',
  '/images/adobe-photoshop.png',
  '/images/adobe-illustrator.png',
  '/images/anti-virus.png',
  '/images/diamond.png',
  '/images/visa.png',
  '/images/apple.png',
  '/images/verified-badge.png',
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

// Fetch: Cache-first for static assets, network-first for everything else
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept Firebase, backend API, or non-GET requests
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('firestore.googleapis.com')) return;
  if (url.hostname.includes('firebase')) return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('gstatic.com')) return;
  if (url.hostname.includes('up.railway.app')) return;
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
        caches.open(CACHE_NAME).then((cache) =>
          cache.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
              if (response && response.status === 200) {
                cache.put(event.request, response.clone());
              }
              return response;
            });
          })
        )
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
