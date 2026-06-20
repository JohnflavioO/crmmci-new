function isAppShellCacheForThisRegistration(name) {
  const hasAppShellBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-|^workbox-|^vite-pwa-/.test(name);
  return hasAppShellBucket && (name.endsWith(self.registration.scope) || name.includes(self.location.origin));
}

function getSafeClientUrl(clientUrl) {
  try {
    const url = new URL(clientUrl);
    const host = url.hostname;
    const isLovablePreview =
      host.startsWith("id-preview--") ||
      host.includes("-preview--") ||
      host === "lovable.app" ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovableproject-dev.com");

    if (isLovablePreview && (url.search.length > 120 || url.search.startsWith("?eyJ"))) {
      url.search = "";
      url.hash = "";
    }

    return url.toString();
  } catch {
    return clientUrl;
  }
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
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(windowClients.map((client) => client.navigate(getSafeClientUrl(client.url))));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);