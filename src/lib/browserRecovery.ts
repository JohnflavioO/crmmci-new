// Recuperação de browser — versão simples e previsível.
// Regra: nunca importar "rescue loaders", nunca recarregar em loop, nunca
// bloquear o bootstrap do React. Apenas storage seguro + limpeza de cache/SW
// e, no máximo, UM reload com cache-bust fora do preview.

const CACHE_VERSION = "v2026-07-28-simple-boot";
const CHUNK_RETRY_KEY = "__mci_chunk_retry_done";

const isLovablePreviewRuntime = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return window.self !== window.top
    || host.startsWith("id-preview--")
    || host.includes("-preview--")
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
  } as Storage;
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
      Object.defineProperty(window, name, { configurable: true, value: fallback });
    } catch {
      // Navegador bloqueou a redefinição; seguimos com o fallback local.
    }
    return fallback;
  }
};

export const installBrowserSafetyGuards = () => {
  ensureSafeStorage("localStorage");
  ensureSafeStorage("sessionStorage");
};

installBrowserSafetyGuards();

export const isLikelyChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? `${error.name} ${error.message} ${error.stack ?? ""}` : String(error);
  return /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|Failed to load module script|Expected a JavaScript module script/i.test(message);
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
      const removable = registrations.filter((registration) => {
        const worker = registration.active || registration.waiting || registration.installing;
        const url = worker?.scriptURL ?? "";
        return url !== "" && !url.includes("/firebase-messaging-sw.js");
      });
      await Promise.all(removable.map((registration) => registration.unregister()));
      unregisteredWorkers = removable.length;
    }
  } catch (error) {
    console.warn("[Recovery] Não foi possível remover service workers:", error);
  }

  return { clearedCaches, unregisteredWorkers };
};

export const reloadWithCacheBust = () => {
  // No preview da Lovable a URL tem token temporário: nunca reescrever.
  if (isLovablePreviewRuntime()) {
    window.location.reload();
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("__mci_cache", CACHE_VERSION);
  window.location.replace(url.toString());
};

// Mantido apenas por compatibilidade: não faz mais limpeza automática nem reload.
export const runOneTimeCacheRefresh = () => {};

export const clearLocalAppStateAndReload = async () => {
  try { window.localStorage.clear(); } catch { /* storage bloqueado */ }
  try { window.sessionStorage.clear(); } catch { /* storage bloqueado */ }
  await clearBrowserCachesAndWorkers();
  reloadWithCacheBust();
};

// Permite no máximo uma tentativa de recarregar por sessão em erro de chunk.
export const shouldRetryChunkLoad = () => {
  try {
    if (window.sessionStorage.getItem(CHUNK_RETRY_KEY) === CACHE_VERSION) return false;
    window.sessionStorage.setItem(CHUNK_RETRY_KEY, CACHE_VERSION);
    return true;
  } catch {
    return false;
  }
};
