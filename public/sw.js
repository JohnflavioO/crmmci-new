function isAppShellCacheForThisRegistration(name) {
  const hasAppShellBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-|^workbox-|^vite-pwa-/.test(name);
  return hasAppShellBucket && (name.endsWith(self.registration.scope) || name.includes(self.location.origin));
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const appShellCacheNames = cacheNames.filter(isAppShellCacheForThisRegistration);
        await Promise.allSettled(appShellCacheNames.map((name) => caches.delete(name)));
        await self.clients.claim();
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);