import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 1. Definição do ambiente
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app");

// 2. Limpeza profunda e preventiva ANTES de qualquer renderização
if (isPreviewHost || isInIframe) {
  console.log('[Preview] Limpeza de segurança iniciada...');
  
  // Desativação total de Service Workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach(reg => {
        reg.unregister();
        console.log('[Preview] SW removido');
      });
    });
  }

  // Limpeza de cache do navegador que causa o erro de "Protocol Error"
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach(n => caches.delete(n));
    });
  }

  // Opcional: Limpar storage se houver loop de erro (apenas se necessário)
  // localStorage.clear();
}

// 3. Renderização
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
