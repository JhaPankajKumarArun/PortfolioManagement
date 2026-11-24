const CACHE_NAME = 'my-portfolio-pwa-v27-historical-valuation';
const APP_SHELL = [
  './js/vendor/pdf.min.js',
  './js/vendor/pdf.worker.min.js',
  './',
  './index.html',
  './css/app.css',
  './js/engines/portfolio.mjs',
  './js/engines/planning.mjs',
  './js/engines/attribution.mjs',
  './js/engines/performance.mjs',
  './js/engines/risk.mjs',
  './js/engines/benchmark.mjs',
  './js/engines/tax.mjs',
  './js/engines/sip.mjs',
  './js/bootstrap.mjs',
  './js/core/errors.mjs',
  './js/core/integrity.mjs',
  './js/services/http.mjs',
  './js/services/refresh.mjs',
  './js/features/financial.mjs',
  './js/core/state.mjs',
  './js/core/storage.mjs',
  './js/core/format.mjs',
  './js/services/cache.mjs',
  './js/services/providers/amfi.mjs',
  './js/services/providers/mfapi.mjs',
  './js/services/providers/benchmark.mjs',
  './js/services/providers/stocks.mjs',
  './js/services/market-data.mjs',
  './js/services/cache.js',
  './js/core.js',
  './js/analytics.js',
  './js/planning.js',
  './js/controller.js',
  './js/ui/views.mjs',
  './js/ui/events.js',
  './js/tax-prices.js',
  './js/fund-analysis.js',
  './js/market-data.js',
  './js/performance.js',
  './js/app.js',
  './js/register-sw.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Network-first for external NAV / mutual fund API calls so live prices stay fresh
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first with background revalidation for local app shell & assets
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
