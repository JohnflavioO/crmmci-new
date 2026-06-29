// Kill-switch for stale app-shell service workers.
// This worker replaces old Workbox/PWA workers at the same path, removes their
// cached app shell, takes control, reloads open tabs once, and unregisters.

function isAppShellCache(name) {
  return /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
}

async function clearAppShellCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.allSettled(cacheNames.filter(isAppShellCache).map((name) => caches.delete(name)));
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
        await clearAppShellCaches();
        await self.clients.claim();
        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(
          clients.map((client) => {
            try {
              return client.navigate(client.url);
            } catch (_) {
              return undefined;
            }
          }),
        );
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
