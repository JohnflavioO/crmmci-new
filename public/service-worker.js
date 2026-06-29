// Kill-switch for stale app-shell service workers.
// It replaces old Workbox/PWA workers at this same path, deletes only their
// app-shell caches, takes control once, refreshes controlled tabs once, and
// unregisters itself. It never intercepts fetch requests.

function isAppShellCache(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return hasWorkboxBucket && (!self.registration.scope || name.endsWith(self.registration.scope));
}

function isPreviewUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.hostname.startsWith("id-preview--")
      || url.hostname.startsWith("preview--")
      || url.hostname.includes("-preview--")
      || url.hostname.endsWith(".lovableproject.com")
      || url.hostname.endsWith(".lovableproject-dev.com")
      || url.hostname.endsWith(".beta.lovable.dev");
  } catch (_) {
    return false;
  }
}

async function clearAppShellCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.allSettled(cacheNames.filter(isAppShellCache).map((name) => caches.delete(name)));
  } catch (_) {
    // cache API may be unavailable/blocked; keep the worker non-fatal.
  }
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        await clearAppShellCaches();
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await Promise.allSettled(
          windowClients.map((client) => {
            if (!client.url || isPreviewUrl(client.url)) return undefined;
            return client.navigate(client.url);
          }),
        );
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
