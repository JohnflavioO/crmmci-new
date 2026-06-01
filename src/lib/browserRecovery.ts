const CACHE_VERSION = "v2026-06-01-2";

const safeStorage = (storage: Storage | undefined, action: (storage: Storage) => void | string | null) => {
  try {
    if (!storage) return null;
    return action(storage) ?? null;
  } catch {
    return null;
  }
};

export const isLikelyChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? `${error.name} ${error.message} ${error.stack ?? ""}` : String(error);
  return /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk/i.test(message);
};

export const clearBrowserCachesAndWorkers = async () => {
  let clearedCaches = 0;
  let unregisteredWorkers = 0;

  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      clearedCaches = names.length;
    }
  } catch (error) {
    console.warn("[Recovery] Não foi possível limpar caches:", error);
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      unregisteredWorkers = registrations.length;
    }
  } catch (error) {
    console.warn("[Recovery] Não foi possível remover service workers:", error);
  }

  return { clearedCaches, unregisteredWorkers };
};

export const reloadWithCacheBust = () => {
  const url = new URL(window.location.href);
  url.searchParams.set("__mci_cache", CACHE_VERSION);
  url.searchParams.set("__mci_reload", String(Date.now()));
  window.location.replace(url.toString());
};

export const runOneTimeCacheRefresh = () => {
  const key = "__mci_cache_version";
  const currentVersion = safeStorage(window.localStorage, (storage) => storage.getItem(key));

  if (currentVersion === CACHE_VERSION) return;

  safeStorage(window.localStorage, (storage) => storage.setItem(key, CACHE_VERSION));

  void clearBrowserCachesAndWorkers().then(({ clearedCaches, unregisteredWorkers }) => {
    const alreadyReloaded = new URL(window.location.href).searchParams.get("__mci_cache") === CACHE_VERSION;
    if (!alreadyReloaded && (clearedCaches > 0 || unregisteredWorkers > 0)) {
      reloadWithCacheBust();
    }
  });
};

export const clearLocalAppStateAndReload = async () => {
  safeStorage(window.localStorage, (storage) => storage.clear());
  safeStorage(window.sessionStorage, (storage) => storage.clear());
  await clearBrowserCachesAndWorkers();
  reloadWithCacheBust();
};

export const shouldRetryChunkLoad = () => {
  const key = "__mci_chunk_retry";
  const retried = safeStorage(window.sessionStorage, (storage) => storage.getItem(key));
  if (retried === CACHE_VERSION) return false;
  safeStorage(window.sessionStorage, (storage) => storage.setItem(key, CACHE_VERSION));
  return true;
};