import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 1. Configuração de recuperação de desastres (deve ser o mais simples possível)
const forceRecovery = () => {
  console.log('[App] Executando recuperação forçada...');
  if (typeof window !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(names => {
        for (const name of names) caches.delete(name);
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) registration.unregister();
      });
    }
    window.location.reload();
  }
};

// 2. Monitor de "Tela Branca" ultra-robusto
// Se o app não renderizar nada em 6 segundos, mostramos um botão de emergência nativo
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const root = document.getElementById("root");
      if (root && root.innerHTML === "") {
        console.error('[App] Watchdog: Tela branca detectada no carregamento inicial.');
        root.innerHTML = `
          <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f2b26; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
            <div style="max-width: 400px;">
              <h1 style="font-size: 24px; margin-bottom: 16px;">Erro de Inicialização</h1>
              <p style="opacity: 0.7; margin-bottom: 24px;">O sistema não conseguiu carregar os componentes principais.</p>
              <button id="recovery-btn" style="background: #10b981; color: white; border: none; padding: 14px 24px; border-radius: 12px; cursor: pointer; font-weight: bold; width: 100%; font-size: 16px;">
                Limpar Cache e Reiniciar
              </button>
            </div>
          </div>
        `;
        document.getElementById('recovery-btn')?.addEventListener('click', forceRecovery);
      }
    }, 6000);
  });

  // Captura erros que acontecem antes do React assumir
  window.onerror = (msg, url, line, col, error) => {
    console.error('[App] Erro crítico capturado:', { msg, url, line, col, error });
    return false;
  };
}

// 3. Inicialização do React
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
