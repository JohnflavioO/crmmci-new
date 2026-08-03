/* eslint-disable no-restricted-globals */
// Mesmo kill-switch mantido no segundo caminho usado por versões antigas.
function isLegacyAppCache(name) {
  return /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-|workbox|vite-pwa|mci.*(?:app|shell|asset)/i.test(name);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.allSettled(names.filter(isLegacyAppCache).map((name) => caches.delete(name)));
      await self.clients.claim();
      const windows = await self.clients.matchAll({ type: "window" });
      await Promise.allSettled(windows.map((client) => client.navigate(client.url)));
    } finally {
      await self.registration.unregister();
    }
  })());
});