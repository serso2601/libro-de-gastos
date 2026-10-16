// Guarda la app (no los datos: esos los guarda la propia app en localStorage) para que abra sin
// conexión con la PC. La página se pide primero a la red y, si no hay, sale de la caché; lo de
// assets/ lleva un hash en el nombre, así que una vez guardado no cambia nunca.

const CACHE = 'libro-gastos-web-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/web/', '/web/manifest.webmanifest'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith('/web/')) return;

  if (url.pathname.startsWith('/web/assets/')) {
    e.respondWith(caches.match(e.request).then((guardado) => guardado || fetch(e.request).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
      return r;
    })));
    return;
  }

  const clave = e.request.mode === 'navigate' ? '/web/' : e.request;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(clave, copia)); }
    return r;
  }).catch(() => caches.match(clave)));
});
