import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import {
  clearBrowserCachesAndWorkers,
  isLikelyChunkLoadError,
  reloadWithCacheBust,
  runOneTimeCacheRefresh,
  shouldRetryChunkLoad,
} from "@/lib/browserRecovery";

console.log('[Main] Inciando renderização...');

const isPreviewRuntime = () => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h.startsWith('id-preview--') || h.includes('-preview--') || h.endsWith('.lovableproject.com');
};

const recoverFromChunkError = (error: unknown) => {
  if (isPreviewRuntime()) return;
  if (!isLikelyChunkLoadError(error) || !shouldRetryChunkLoad()) return;

  console.warn('[Main] Falha ao carregar módulo detectada. Limpando cache e recarregando...', error);
  void clearBrowserCachesAndWorkers().finally(() => reloadWithCacheBust());
};

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    recoverFromChunkError(event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    recoverFromChunkError(event.reason);
  });
  if (!isPreviewRuntime()) {
    runOneTimeCacheRefresh();
  }
}

try {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    console.log('[Main] Elemento root encontrado');
    const root = createRoot(rootElement);
    root.render(<App />);
    console.log('[Main] Renderização solicitada');
  } else {
    console.error('[Main] Elemento root não encontrado!');
  }
} catch (error) {
  console.error('[Main] Erro fatal durante a renderização:', error);
}
