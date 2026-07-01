// Permanent kill-switch app-shell service worker.
// MCI CRM does not use offline app-shell caching. This file exists only to
// replace old Workbox/PWA workers at the same URL and unregister them safely.
// Important: do NOT navigate clients from here. Some browsers kept reloading
// the Lovable preview iframe while this worker was activating, causing a blank
// preview loop. The page bootstrap handles a single safe reload after unregister.

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
