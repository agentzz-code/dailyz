const RUNTIME_CACHE = 'dailykrd-offline-v1';

// Any cache that starts with this prefix is considered ours and eligible for
// cleanup on activate when it is no longer the active cache version.
const CACHE_PREFIX = 'dailykrd-';

// The app entry point. Because Daily.KRD is a single-file PWA, `./` resolves to
// index.html and is the only asset we can safely precache without guessing.
// All other same-origin GETs are cached dynamically at runtime instead.
const PRECACHE_URLS = ['./'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(RUNTIME_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Take control of open pages immediately.
            self.clients.claim(),
            // Remove old Daily.KRD cache versions that are no longer needed.
            caches.keys().then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== RUNTIME_CACHE)
                        .map((key) => caches.delete(key))
                )
            )
        ])
    );
});

// OFFLINE CACHING
// Strategy: network-first with cache fallback for same-origin GET requests.
//  - Successful same-origin GET responses are saved to the runtime cache.
//  - When the network fails, the cached copy is served so the app works offline.
//  - Non-GET requests (POST/PUT/DELETE) are never intercepted or cached.
//  - Cross-origin requests are passed straight through untouched, so dynamic
//    API responses are never cached — with ONE exception: the Firebase SDK
//    modules on gstatic.com. They are immutable, versioned files and the app
//    literally cannot boot without them, so they are cached cache-first to
//    make fully-offline launches deterministic (the browser HTTP cache is
//    not reliable enough to depend on).
self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Never touch non-GET requests (POST/PUT/DELETE, etc.).
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Firebase SDK modules (cross-origin, versioned, immutable).
    if (url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request)
                    .then((response) => {
                        if (response && response.ok) {
                            const copy = response.clone();
                            caches
                                .open(RUNTIME_CACHE)
                                .then((cache) => cache.put(request, copy));
                        }
                        return response;
                    })
                    .catch(() => caches.match(request));
            })
        );
        return;
    }

    // Only handle same-origin requests. Firebase data/auth APIs, Cloudflare
    // Worker push/AI, and all other dynamic APIs are cross-origin, so they
    // are automatically excluded from offline caching here.
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                // Cache a copy of successful responses for offline use.
                if (response && response.ok) {
                    const copy = response.clone();
                    caches
                        .open(RUNTIME_CACHE)
                        .then((cache) => cache.put(request, copy));
                }
                return response;
            })
            .catch(() =>
                caches.match(request).then((cached) => {
                    if (cached) return cached;
                    // For page navigations, fall back to the cached app shell
                    // (index.html) so relative routes like `./` still load offline.
                    if (request.mode === 'navigate') {
                        const root = new Request(
                            new URL('./', self.registration.scope).toString()
                        );
                        return caches.match(root);
                    }
                    // Uncached asset offline: let the network error surface.
                    return undefined;
                })
            )
    );
});

// PUSH NOTIFICATION RECEIVER
self.addEventListener('push', (event) => {
    let payload = {
        title: 'Daily.KRD',
        body: 'You have a new update!',
        icon: './icons/icon-192.png',
        badge: './icons/icon-32.png',
        data: { url: './' }
    };

    if (event.data) {
        try {
            const json = event.data.json();
            payload = { ...payload, ...json };
        } catch (e) {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body,
        icon: payload.icon || './icons/icon-192.png',
        badge: payload.badge || './icons/icon-32.png',
        data: payload.data || { url: './' },
        vibrate: [200, 100, 200],
        renotify: true,
        tag: 'dailykrd-' + Date.now()
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// NOTIFICATION CLICK ROUTING (Deep Linking)
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    if ('navigate' in client && targetUrl !== './') {
                        client.navigate(targetUrl);
                    }
                    return;
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
