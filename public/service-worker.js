// Kill-switch for stale app-shell service workers. It removes only this app's
// Workbox caches, takes control once, then unregisters itself without forcing
// navigation inside Lovable's tokenized preview iframe.
function isWorkboxCacheForThisRegistration(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return hasWorkboxBucket && name.endsWith(self.registration.scope);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const workboxCacheNames = cacheNames.filter(isWorkboxCacheForThisRegistration);
        await Promise.allSettled(workboxCacheNames.map((name) => caches.delete(name)));
        await self.clients.claim();
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);

self.addEventListener("fetch", () => {
  // No responseWith: browser performs the normal network request.
});
