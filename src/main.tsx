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

const recoverFromChunkError = (error: unknown) => {
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
  runOneTimeCacheRefresh();
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
