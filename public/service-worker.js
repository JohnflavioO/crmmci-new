// Permanent kill-switch app-shell service worker.
// Kept at this legacy path only to evict old PWA/Workbox registrations safely.
// It has NO fetch handler and never navigates clients, because Lovable preview
// URLs use temporary tokens and client.navigate/reload can break the preview.

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
