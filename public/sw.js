// IRONCORE Service Worker: App offline verfügbar halten.
// Strategie: sofort aus dem Cache antworten, im Hintergrund aktualisieren – der nächste Start zeigt die neue Version.
// Liegt unter /sw.js wie die Vorgänger (GRIND EMPIRE, FIT) und ersetzt sie; alte Caches werden gelöscht.
// Bei jeder Änderung an App-Dateien VERSION erhöhen (Test prüft, dass ASSETS vollständig ist).
const VERSION = 'ironcore-7';
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
  '/js/can.js',
  '/js/schedule.js',
  '/js/shopping.js',
  '/js/gamify.js',
  '/js/routine.js',
  '/js/notify.js',
  '/js/photoutil.js',
  '/js/views/home.js',
  '/js/views/training.js',
  '/js/views/session.js',
  '/js/views/nutrition.js',
  '/js/views/progress.js',
  '/js/views/goals.js',
  '/js/views/settings.js',
  '/js/views/supps.js',
  '/js/views/mealplan.js',
  '/vendor/html5-qrcode.min.js',
  '/js/mascot.js',
  '/js/tour.js',
  '/js/coach.js',
  '/js/fooddb.js',
  '/images/mascot/celebrating.webp',
  '/images/mascot/determined.webp',
  '/images/mascot/explaining.webp',
  '/images/mascot/focused.webp',
  '/images/mascot/friendly.webp',
  '/images/mascot/goals.webp',
  '/images/mascot/happy.webp',
  '/images/mascot/motivated.webp',
  '/images/mascot/neutral.webp',
  '/images/mascot/nutrition.webp',
  '/images/mascot/portrait.webp',
  '/images/mascot/shopping.webp',
  '/images/mascot/supplements.webp',
  '/images/mascot/supportive.webp',
  '/images/mascot/thinking.webp',
  '/images/mascot/water.webp',
  '/images/mascot/welcome.webp',
  '/images/mascot/workout.webp',
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

// Antippen einer Erinnerung: offene App nach vorn holen oder den Tagesplan öffnen
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
