// IRONCORE Service Worker: App offline verfügbar halten.
// Strategie: sofort aus dem Cache antworten, im Hintergrund aktualisieren – der nächste Start zeigt die neue Version.
// Liegt unter /sw.js wie die Vorgänger (GRIND EMPIRE, FIT) und ersetzt sie; alte Caches werden gelöscht.
// Bei jeder Änderung an App-Dateien VERSION erhöhen (Test prüft, dass ASSETS vollständig ist).
const VERSION = 'ironcore-1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/css/ironcore.css',
  '/fonts/inter.woff2',
  '/fonts/space-grotesk.woff2',
  '/js/main.js',
  '/js/core.js',
  '/js/domain.js',
  '/js/logic.js',
  '/js/store.js',
  '/js/seed.js',
  '/js/ui.js',
  '/js/scanner.js',
  '/js/views/home.js',
  '/js/views/training.js',
  '/js/views/session.js',
  '/js/views/nutrition.js',
  '/js/views/progress.js',
  '/js/views/goals.js',
  '/js/views/settings.js',
  '/vendor/html5-qrcode.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const key = req.mode === 'navigate' ? '/index.html' : url.pathname;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(key);
      const fresh = fetch(req)
        .then((res) => { if (res.ok && res.type === 'basic') cache.put(key, res.clone()); return res; })
        .catch(() => cached || Response.error());
      if (cached) { e.waitUntil(fresh.catch(() => {})); return cached; }
      return fresh;
    }),
  );
});
