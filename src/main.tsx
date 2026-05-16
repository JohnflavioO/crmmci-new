import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import DiagnosticErrorBoundary from "@/components/DiagnosticErrorBoundary";

// 1. Limpeza agressiva de Cache e Service Workers em ambiente de Preview/Dev
const isPreview = typeof window !== 'undefined' && (
  window.location.hostname.includes('lovable.app') || 
  window.location.hostname.includes('lovableproject.com') ||
  window.location.hostname.includes('localhost') ||
  window.location.hostname.includes('127.0.0.1')
);

if (isPreview && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
      console.log('[App] ServiceWorker removido preventivamente.');
    }
  }).catch(err => console.error('[App] Erro ao remover SW:', err));

  // Limpar caches antigos que podem estar causando tela branca
  if ('caches' in window) {
    caches.keys().then(names => {
      for (const name of names) caches.delete(name);
    }).catch(err => console.error('[App] Erro ao limpar caches:', err));
  }
}

// 2. Logger de inicialização
console.log('[App] Iniciando renderização...', {
  time: new Date().toISOString(),
  preview: isPreview
});

// 3. Monitor de "Tela Branca" (Watchdog)
// Se em 8 segundos nada tiver sido renderizado no #root, tentamos um "reparo suave"
const watchdogTimer = setTimeout(() => {
  const root = document.getElementById("root");
  if (root && root.innerHTML === "") {
    console.error('[App] Watchdog: Tela branca detectada! Forçando recarregamento...');
    localStorage.removeItem('supabase.auth.token'); // Limpeza mínima de segurança
    window.location.reload();
  }
}, 8000);

// 4. Captura global de erros com UI de fallback nativa (fora do React)
window.onerror = (message, source, lineno, colno, error) => {
  const msg = typeof message === 'string' ? message : 'Erro desconhecido';
  
  // Ignorar erros comuns que não quebram o app
  if (msg.includes('Extension') || msg.includes('Script error') || msg.includes('Failed to fetch')) return false;

  console.error('[App] Erro crítico global:', { message, source, lineno, colno, error });
  
  const rootElement = document.getElementById("root");
  if (rootElement && rootElement.innerHTML === "") {
    rootElement.innerHTML = `
      <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f2b26; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
        <div style="max-width: 400px;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">Erro de Inicialização</h1>
          <p style="opacity: 0.7; margin-bottom: 24px;">O sistema encontrou um erro crítico ao carregar.</p>
          <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 24px; text-align: left;">
            <code style="color: #ef4444; font-size: 12px; word-break: break-all;">${msg}</code>
          </div>
          <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.reload();" 
                  style="background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%;">
            Limpar Cache e Reiniciar
          </button>
        </div>
      </div>
    `;
  }
  return false;
};

const rootElement = document.getElementById("root");
if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <DiagnosticErrorBoundary>
        <App />
      </DiagnosticErrorBoundary>
    );
    // Se chegou aqui e renderizou, cancelamos o watchdog
    clearTimeout(watchdogTimer);
  } catch (error) {
    console.error('[App] Erro fatal no root.render:', error);
  }
}
