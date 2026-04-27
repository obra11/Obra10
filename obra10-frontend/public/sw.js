const CACHE_NAME = 'obra10-v1.5.2';
const STATIC_ASSETS = [
  '/',
  '/favicon-16.png',
  '/favicon-32.png',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // Não esperar tabs fecharem
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => {
      // Notificar todos os clients que uma nova versão foi ativada
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
        });
      });
      return self.clients.claim(); // Tomar controle de todas as tabs
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only cache GET requests
  if (request.method !== 'GET') return;
  
  // Don't cache API calls
  if (request.url.includes('/api/') || request.url.includes(':3000')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      // Network-first for HTML, cache-first for assets
      if (request.destination === 'document') {
        return fetch(request).catch(() => cached || new Response('Offline', { status: 503 }));
      }
      return cached || fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
