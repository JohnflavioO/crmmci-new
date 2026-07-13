const CACHE_VERSION = "v2026-07-01-stable-preview-entry";
const PREVIEW_CHUNK_RECOVERY_KEY = "__mci_preview_chunk_recovery_done";

const isLovablePreviewRuntime = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return window.self !== window.top
    || host.startsWith("id-preview--")
    || host.includes("-preview--")
    || host.includes("lovable.app")
    || host.endsWith(".lovableproject.com")
    || host.endsWith(".lovableproject-dev.com")
    || host.endsWith(".beta.lovable.dev");
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
  const isPreview = isLovablePreviewRuntime();
  const appShellWorkerPaths = ["/sw.js", "/service-worker.js"];

  try {
    if ("caches" in window) {
      const names = await caches.keys();
      const removableNames = names.filter((name) => {
        const isAppShellCache = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name)
          && (name.includes(window.location.origin) || name.includes(window.location.host));
        return isPreview ? isAppShellCache : true;
      });
      await Promise.all(removableNames.map((name) => caches.delete(name)));
      clearedCaches = removableNames.length;
    }
  } catch (error) {
    console.warn("[Recovery] Não foi possível limpar caches:", error);
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const sameOriginRegistrations = registrations.filter((registration) => {
        const worker = registration.active || registration.waiting || registration.installing;
        if (!worker?.scriptURL) return false;
        try {
          const url = new URL(worker.scriptURL);
          const isSameOrigin = url.origin === window.location.origin;
          const isAppShellWorker = appShellWorkerPaths.includes(url.pathname);
          return isSameOrigin && (isPreview ? true : true);
        } catch {
          return false;
        }
      });
      await Promise.all(sameOriginRegistrations.map((registration) => registration.unregister()));
      unregisteredWorkers = sameOriginRegistrations.length;
    }
  } catch (error) {
    console.warn("[Recovery] Não foi possível remover service workers:", error);
  }

  return { clearedCaches, unregisteredWorkers };
};

export const reloadWithCacheBust = () => {
  if (isLovablePreviewRuntime()) {
    void clearBrowserCachesAndWorkers();
    try {
      window.sessionStorage.setItem(PREVIEW_CHUNK_RECOVERY_KEY, CACHE_VERSION);
    } catch {
      // Evita location.reload/replace/history URL changes no preview: isso pode invalidar a URL autorizada do editor.
    }
    return;
  }

  const url = new URL(window.location.href);

  url.searchParams.set("__mci_cache", CACHE_VERSION);
  url.searchParams.set("__mci_reload", String(Date.now()));
  url.searchParams.set("__mci_chunk_retry", "1");
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
  if (isLovablePreviewRuntime()) {
    await clearBrowserCachesAndWorkers();
    return;
  }

  safeStorage("localStorage", (storage) => storage.clear());
  safeStorage("sessionStorage", (storage) => storage.clear());
  await clearBrowserCachesAndWorkers();
  reloadWithCacheBust();
};

export const shouldRetryChunkLoad = () => {
  if (isLovablePreviewRuntime()) {
    try {
      return window.sessionStorage.getItem(PREVIEW_CHUNK_RECOVERY_KEY) !== CACHE_VERSION;
    } catch {
      return false;
    }
  }

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("__mci_chunk_retry") === "1") return false;
    return true;
  } catch {
    return false;
  }
};
