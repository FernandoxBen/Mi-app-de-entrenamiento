/* Entreno 2.2 · service worker */
const V = 'entreno-v2.2.0';
const SHELL = V + '-shell';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-maskable.png',
  // iconos de los accesos rápidos al mantener pulsado
  './ic-upper-a-192.png', './ic-pierna-192.png', './ic-upper-b-192.png', './ic-crossfit-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => !k.startsWith(V)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navegación: red primero, cache de respaldo (para que una versión nueva entre sola)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { const c = r.clone(); caches.open(SHELL).then(cc => cc.put('./index.html', c)); return r; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Mismo origen: cache primero
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r && r.ok) { const c = r.clone(); caches.open(SHELL).then(cc => cc.put(req, c)); }
        return r;
      }).catch(() => hit))
    );
  }
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
