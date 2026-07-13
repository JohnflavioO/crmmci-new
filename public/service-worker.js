// Permanent kill-switch app-shell service worker.
// Kept at this legacy path only to evict old PWA/Workbox registrations safely.
// It has NO fetch handler and navigates clients only once with a marker.

function isOldAppShellCache(name) {
  return /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
}

function isLovablePreviewUrl(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname;
    return host.startsWith("id-preview--")
      || host.startsWith("preview--")
      || host.includes("-preview--")
      || host.endsWith(".lovableproject.com")
      || host.endsWith(".lovableproject-dev.com")
      || host.endsWith(".beta.lovable.dev");
  } catch (_) {
    return false;
  }
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
        await self.registration.unregister();
        await Promise.allSettled(windowClients.map((client) => {
          try {
            if (isLovablePreviewUrl(client.url)) return client.navigate(client.url);
            const url = new URL(client.url);
            if (url.searchParams.get("__mci_sw_evicted") === "1") return undefined;
            url.searchParams.set("__mci_sw_evicted", "1");
            url.searchParams.set("__mci_reload", String(Date.now()));
            return client.navigate(url.toString());
          } catch (_) {
            return undefined;
          }
        }));
      } finally {}
    })(),
  );
});
