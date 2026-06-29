// Kill-switch for stale app-shell service workers.
// This worker must be able to take over browsers still controlled by an older
// Workbox/PWA worker and force every request back to the network.

async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.allSettled(cacheNames.map((name) => caches.delete(name)));
  } catch (_) {
    // cache API may be unavailable/blocked; keep the worker non-fatal.
  }
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        await clearAllCaches();
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await Promise.allSettled(windowClients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
