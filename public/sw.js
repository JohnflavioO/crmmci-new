// No-op kill-switch for stale app-shell service workers.
// Official recovery pattern: install/activate immediately, reload controlled
// windows once, and do not define any fetch handler so all requests bypass SW.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const windowClients = await self.clients.matchAll({ type: "window" });
      await Promise.allSettled(windowClients.map((client) => client.navigate(client.url)));
    })(),
  ),
);
