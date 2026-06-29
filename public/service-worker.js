// Permanent no-op app-shell service worker.
// Kept at this legacy path only to evict old PWA/Workbox registrations safely.
// It has NO fetch handler and never reloads/navigates clients.

function isOldAppShellCache(name) {
  return /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        if (typeof caches !== "undefined") {
          const names = await caches.keys();
          await Promise.allSettled(names.filter(isOldAppShellCache).map((name) => caches.delete(name)));
        }
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});
