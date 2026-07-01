// Permanent kill-switch app-shell service worker.
// MCI CRM does not use offline app-shell caching. This file exists only to
// replace old Workbox/PWA workers at the same URL and unregister them safely.
// It navigates controlled pages ONCE with a marker so a blank page controlled by
// an old cached app shell gets released without entering an iframe reload loop.

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
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await Promise.allSettled(windowClients.map((client) => {
          try {
            const url = new URL(client.url);
            if (url.searchParams.get("__mci_sw_evicted") === "1") return undefined;
            url.searchParams.set("__mci_sw_evicted", "1");
            url.searchParams.set("__mci_reload", String(Date.now()));
            return client.navigate(url.toString());
          } catch (_) {
            return undefined;
          }
        }));
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});
