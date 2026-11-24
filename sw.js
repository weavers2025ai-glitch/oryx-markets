/* Oryx Markets service worker — app shell caching for the installable web app.
   Pages: network-first (always fresh when online). Assets: cache-first
   (they are versioned with ?v= in the HTML, so updates arrive as new URLs). */
const CACHE = 'oryx-v1';
const SHELL = [
  './', './index.html', './markets.html', './accounts.html', './about.html', './contact.html',
  './login.html', './register.html', './dashboard.html', './trade.html',
  './assets/style.css', './assets/store.js', './assets/chrome.js', './assets/chart.js',
  './assets/support.js', './assets/install.js', './data/instruments.js',
  './icon-192.png', './icon-512.png', './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: false }).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
