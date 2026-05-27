const CACHE_NAME = 'obra10-v1.5.6';
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
  
  // Only handle GET requests
  if (request.method !== 'GET') return;
  
  const url = new URL(request.url);

  // Apenas cacheia assets estáticos conhecidos. Nunca cachear chamadas de API.
  const isGoogleFont = 
    url.hostname.includes('fonts.gstatic.com') || 
    url.hostname.includes('fonts.googleapis.com');

  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/' ||
    url.pathname === '/manifest.json' ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    isGoogleFont;

  // SPA navigation documents (like /login, /admin/empresas, /dashboard) request the HTML page
  const isNavigation = request.destination === 'document';

  if (!isStaticAsset && !isNavigation) {
    // É uma requisição de API dinâmica (ex: /admin/empresas, /obras, /usuarios)
    // Deixa passar direto para a rede sem encostar no cache do Service Worker
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      // Network-first para páginas/documentos (index.html de navegação)
      if (isNavigation) {
        return fetch(request).catch(() => cached || new Response('Offline', { status: 503 }));
      }
      // Cache-first para assets estáticos compilados
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

