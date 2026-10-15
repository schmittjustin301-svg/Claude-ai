// FIT Service Worker: App-Dateien offline verfügbar halten.
// Strategie: sofort aus dem Cache antworten, im Hintergrund aktualisieren.
// Nach einem Update zeigt der nächste App-Start die neue Version.
const CACHE = 'fit-v2';
const ASSETS = [
  '/fit/',
  '/fit/index.html',
  '/fit/app.js',
  '/fit/styles.css',
  '/fit/manifest.webmanifest',
  '/fit/icon.svg',
  '/fit/icon-192.png',
  '/fit/icon-512.png',
  '/fit/apple-touch-icon.png',
  '/fit/vendor/html5-qrcode.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fit-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith('/fit/')) return;
  const key = req.mode === 'navigate' ? '/fit/index.html' : req;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => { if (res.ok) cache.put(key, res.clone()); return res; })
        .catch(() => cached);
      if (cached) { e.waitUntil(fresh); return cached; }
      return fresh;
    }),
  );
});
