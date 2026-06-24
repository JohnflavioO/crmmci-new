// Service-worker kill switch: never cache, never redirect/reload preview URLs.
function isAppShellCache(name) {
  return /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-|workbox|mci/i.test(name);
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.allSettled(cacheNames.filter(isAppShellCache).map((name) => caches.delete(name)));
      await self.clients.claim();
      await self.registration.unregister();
    })(),
  );
});

self.addEventListener("fetch", () => {
  // Intentionally empty: let the browser perform the normal network request.
});
