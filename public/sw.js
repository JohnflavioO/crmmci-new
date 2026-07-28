/* eslint-disable no-restricted-globals */
// Kill-switch permanente para Service Workers antigos gerados por PWA/app-shell.
// O CRM MCI não usa SW para servir a interface; isso evita tela branca por cache velho.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    } catch (_) {
      // Cache API indisponível/bloqueada.
    }

    try {
      await self.registration.unregister();
    } catch (_) {
      // Registro já removido.
    }

    try {
      const clientsList = await clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(clientsList.map((client) => {
        if ("navigate" in client) return client.navigate(client.url);
        return Promise.resolve();
      }));
    } catch (_) {
      // Sem clientes navegáveis.
    }
  })());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});