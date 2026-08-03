/* eslint-disable no-restricted-globals */
// Kill-switch do antigo app-shell. Não possui fetch handler: toda navegação
// volta imediatamente para a rede e o worker de mensagens permanece intacto.
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