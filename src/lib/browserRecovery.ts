const CACHE_VERSION = "v2026-06-20-preview-safe-recovery";

const isLovablePreviewRuntime = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.startsWith("id-preview--") || host.includes("-preview--") || host.endsWith(".lovableproject.com");
};

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, String(value)),
  };
};

const ensureSafeStorage = (name: "localStorage" | "sessionStorage") => {
  if (typeof window === "undefined") return undefined;

  try {
    const storage = window[name];
    const testKey = `__mci_storage_test_${Date.now()}`;
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch {
    const fallback = createMemoryStorage();
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        value: fallback,
      });
    } catch {
      // Se o navegador bloquear a redefinição, seguimos com o fallback em memória.
    }
    return fallback;
  }
};

export const installBrowserSafetyGuards = () => {
  ensureSafeStorage("localStorage");
  ensureSafeStorage("sessionStorage");
};

installBrowserSafetyGuards();

const getSafeStorage = (name: "localStorage" | "sessionStorage") => ensureSafeStorage(name);

const safeStorage = (name: "localStorage" | "sessionStorage", action: (storage: Storage) => void | string | null) => {
  try {
    const storage = getSafeStorage(name);
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

  if (isLovablePreviewRuntime()) {
    return { clearedCaches, unregisteredWorkers };
  }

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

  if (isLovablePreviewRuntime()) {
    window.location.reload();
    return;
  }

  url.searchParams.set("__mci_cache", CACHE_VERSION);
  url.searchParams.set("__mci_reload", String(Date.now()));
  window.location.replace(url.toString());
};

export const runOneTimeCacheRefresh = () => {
  if (isLovablePreviewRuntime()) return;

  const key = "__mci_cache_version";
  const currentVersion = safeStorage("localStorage", (storage) => storage.getItem(key));

  if (currentVersion === CACHE_VERSION) return;

  safeStorage("localStorage", (storage) => storage.setItem(key, CACHE_VERSION));

  void clearBrowserCachesAndWorkers().then(({ clearedCaches, unregisteredWorkers }) => {
    const alreadyReloaded = new URL(window.location.href).searchParams.get("__mci_cache") === CACHE_VERSION;
    if (!alreadyReloaded && (clearedCaches > 0 || unregisteredWorkers > 0)) {
      reloadWithCacheBust();
    }
  });
};

export const clearLocalAppStateAndReload = async () => {
  safeStorage("localStorage", (storage) => storage.clear());
  safeStorage("sessionStorage", (storage) => storage.clear());
  await clearBrowserCachesAndWorkers();
  reloadWithCacheBust();
};

export const shouldRetryChunkLoad = () => {
  const key = "__mci_chunk_retry";
  const retried = safeStorage("sessionStorage", (storage) => storage.getItem(key));
  if (retried === CACHE_VERSION) return false;
  safeStorage("sessionStorage", (storage) => storage.setItem(key, CACHE_VERSION));
  return true;
};