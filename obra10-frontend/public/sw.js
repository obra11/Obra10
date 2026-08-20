const CACHE_NAME = 'obra10-v2.9.12';
// Não pré-cachear '/' nem imagens de marca — HTML/JS antigos mostravam watermark Lunardeli.
const STATIC_ASSETS = [
  '/favicon-16.png',
  '/favicon-32.png',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-obra10.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => {
        // 1ª instalação: ativa na hora (Chrome só sugere “Instalar app” com SW ativo).
        // Atualizações seguintes: espera o botão “Atualizar” (SKIP_WAITING).
        if (!self.registration.active) {
          return self.skipWaiting();
        }
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
          });
        }),
      ),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  const isGoogleFont =
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com');

  // JS/CSS/HTML: sempre rede primeiro (evita watermark/layout antigo no cache)
  const isAppShell =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/sw.js' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/version.json' ||
    url.pathname === '/version' ||
    url.pathname === '/index.html';

  const isStaticAsset =
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    isGoogleFont;

  // Nunca cachear /brand (logos Lunardeli) — evita watermark fantasma
  if (url.pathname.startsWith('/brand/')) {
    event.respondWith(fetch(request));
    return;
  }

  if (!isAppShell && !isStaticAsset) return;

  event.respondWith(
    (async () => {
      if (isAppShell) {
        try {
          return await fetch(request, { cache: 'no-store' });
        } catch {
          const cached = await caches.match(request);
          return cached || new Response('Offline', { status: 503 });
        }
      }
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    })(),
  );
});
