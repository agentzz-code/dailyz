const CACHE_NAME = 'dailykrd-push-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
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
