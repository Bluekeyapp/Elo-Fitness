// Bump RELEASE and every ?v= reference together when changing the app shell.
const RELEASE = '3';
const PREFIX = `glutelab-${encodeURIComponent(self.registration.scope)}-`;
const CACHE_NAME = `${PREFIX}${RELEASE}`;
const ASSETS = [
  './styles.css?v=3', './js/ui.js?v=3', './js/program.js?v=3',
  './js/state.js?v=3', './js/storage.js?v=3', './js/timer.js?v=3', './js/updates.js?v=3',
  './manifest.webmanifest', './icon.svg'
].map(path => new URL(path, self.registration.scope).href);
const INDEX = new URL('./index.html', self.registration.scope).href;
const appropriate = response => response.ok && response.type !== 'opaque' && !response.redirected;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const existing = await caches.keys();
    const cache = await caches.open(CACHE_NAME);
    await Promise.all([INDEX, ...ASSETS].map(async url => {
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (!appropriate(response)) throw new Error('App shell unavailable');
      await cache.put(url, response);
    }));
    // v1/v2 pages have no update UI. Escape their cache-first worker once;
    // the next navigation loads fresh HTML. Later releases wait for consent.
    if (existing.some(key => /^glutelab-v[12]$/.test(key)) && !existing.some(key => key.startsWith(PREFIX))) await self.skipWaiting();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME &&
      (key.startsWith(PREFIX) || /^glutelab-v[12]$/.test(key))).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
async function navigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(request, { signal: controller.signal, cache: 'no-cache' });
    if (appropriate(response) && response.headers.get('content-type')?.includes('text/html')) {
      const path = new URL(request.url).pathname;
      const sameRelease = (await response.clone().text()).includes(`./js/ui.js?v=${RELEASE}`);
      // Keep a coherent offline shell if a newer HTML release arrives before its worker installs.
      if (sameRelease && (path === new URL(INDEX).pathname || path === new URL(self.registration.scope).pathname)) {
        try { await cache.put(INDEX, response.clone()); } catch { /* Network response remains usable. */ }
      }
      return response;
    }
    if (response.status < 500) return response;
    return (await cache.match(INDEX)) || response;
  } catch { return (await cache.match(INDEX)) || Response.error(); }
  finally { clearTimeout(timeout); }
}
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url), scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (request.mode === 'navigate') { event.respondWith(navigation(request)); return; }
  // Only known successful assets; never substitute HTML for JS/CSS/images.
  if (!ASSETS.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME), cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (appropriate(response)) { try { await cache.put(request, response.clone()); } catch { /* Quota. */ } }
    return response;
  })());
});
