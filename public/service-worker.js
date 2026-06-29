// Kill-switch for stale app-shell service workers.
// This worker replaces old Workbox/PWA workers at the same path, removes their
// cached app shell, takes control, and unregisters. It deliberately avoids a
// fetch handler and client.navigate(), because either can turn a valid editor
// iframe into a browser-level unavailable/blank page.

function isAppShellCache(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return hasWorkboxBucket && (!self.registration.scope || name.endsWith(self.registration.scope) || name.includes(self.location.origin));
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
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
