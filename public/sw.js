// Kill-switch for stale app-shell service workers. It removes old caches,
// takes control, unregisters itself, then reloads controlled clients once.
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
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await Promise.allSettled(
          clients.map((client) => {
            const url = new URL(client.url);
            if (url.searchParams.get("__mci_sw_recovered") === "1") return undefined;
            url.searchParams.set("__mci_sw_recovered", "1");
            return client.navigate(url.toString());
          }),
        );
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);

self.addEventListener("fetch", () => {
  // No responseWith: browser performs the normal network request.
});
