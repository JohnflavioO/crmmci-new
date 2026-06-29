// Kill-switch for stale app-shell service workers.
// Important: do NOT add a fetch handler here. A worker that intercepts the
// editor preview navigation can make Chrome show "page unavailable" before
// React/Vite ever runs. This file only clears old app caches and unregisters.

async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.allSettled(cacheNames.map((name) => caches.delete(name)));
  } catch (_) {
    // cache API may be unavailable/blocked; keep the worker non-fatal.
  }
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        await clearAllCaches();
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
