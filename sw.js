// Service Worker for Big Pine Key Fishing App
// Network-first for HTML pages (always fresh), cache fallback for offline use

const CACHE_NAME = 'bpk-fishing-v3';
const APP_SHELL = [
  '/index.html',
  '/radar.html',
  '/tides.html',
  '/species.html',
  '/manifest.json'
];

// Install: cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: remove ALL old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//   - API calls → always network (live data)
//   - HTML pages → network-first, cache fallback (always shows latest code)
//   - Everything else → cache-first, network fallback (images, fonts, icons)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always live: API data
  if (
    url.hostname.includes('api.open-meteo.com') ||
    url.hostname.includes('api.tidesandcurrents.noaa.gov') ||
    url.hostname.includes('radar.weather.gov') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('cdn.tailwindcss.com')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first for HTML pages — ensures updates are always visible
  const isHTML = url.pathname.endsWith('.html') ||
                 url.pathname === '/' ||
                 APP_SHELL.includes(url.pathname);
  if (isHTML) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (icons, images, static assets)
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
