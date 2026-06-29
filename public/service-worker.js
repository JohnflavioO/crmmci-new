// Kill-switch for stale app-shell service workers.
// It replaces old Workbox/PWA workers at this same path, deletes only their
// app-shell caches, takes control once, refreshes controlled tabs once, and
// unregisters itself. It never intercepts fetch requests.

function isAppShellCache(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return hasWorkboxBucket && (!self.registration.scope || name.endsWith(self.registration.scope));
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

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        await clearAppShellCaches();
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await Promise.allSettled(
          windowClients.map((client) => client.url ? client.navigate(client.url) : undefined),
        );
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
