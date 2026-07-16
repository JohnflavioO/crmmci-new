// Permanent kill-switch app-shell service worker.
// MCI CRM does not use offline app-shell caching. This file exists only to
// replace old Workbox/PWA workers at the same URL and unregister them safely.
// It never navigates controlled pages, because Lovable preview URLs use
// temporary tokens and client.navigate/reload can break the editor preview.

function isOldAppShellCache(name) {
  return /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
}

function isWorkboxCacheForThisRegistration(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return hasWorkboxBucket && name.endsWith(self.registration.scope);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        if (typeof caches !== "undefined") {
          const names = await caches.keys();
          await Promise.allSettled(names.filter(isWorkboxCacheForThisRegistration).map((name) => caches.delete(name)));
        }
        await self.clients.claim();
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});
