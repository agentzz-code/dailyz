// Daily.KRD service worker — handles background push notifications

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

// Fired when a push message arrives from the server, even if the app is closed
self.addEventListener("push", event => {

    let data = {};

    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: "Daily.KRD", body: event.data ? event.data.text() : "" };
    }

    const title = data.title || "Daily.KRD";

    const options = {
        body: data.body || "",
        icon: "icons/icon-192.png",
        badge: "icons/icon-192.png",
        tag: data.tag || "prayer-notification",
        data: { url: data.url || "./index.html" }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Fired when the user taps the notification
self.addEventListener("notificationclick", event => {

    event.notification.close();

    const targetUrl = event.notification.data?.url || "./index.html";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {

            for (const client of windowClients) {
                if (client.url.includes("index.html") && "focus" in client) {
                    return client.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
