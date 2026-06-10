import { createRoot } from "react-dom/client";
import { clearLocalAppStateAndReload, runOneTimeCacheRefresh } from "./lib/browserRecovery";
import "./index.css";

runOneTimeCacheRefresh();


// Watchdog UI injection for early recovery
const injectWatchdogUI = (root: HTMLElement, message: string = "O sistema demorou muito para iniciar. Isso pode ser um problema de cache ou conexão.") => {
  root.innerHTML = `
    <div id="watchdog-ui" style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f2b26; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
      <div style="max-width: 400px;">
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h1 style="font-size: 24px; margin-bottom: 16px; font-weight: bold;">Erro de Carregamento</h1>
        <p style="opacity: 0.7; margin-bottom: 24px; line-height: 1.5;">${message}</p>
        <button id="recovery-btn" style="background: #10b981; color: white; border: none; padding: 14px 24px; border-radius: 12px; cursor: pointer; font-weight: bold; width: 100%; font-size: 16px;">
          Limpar Cache e Reiniciar
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('recovery-btn')?.addEventListener('click', () => {
    void clearLocalAppStateAndReload();
  });
};

const watchdog = (() => {
  if (typeof window === 'undefined') return null;

  return setTimeout(() => {
    const root = document.getElementById("root");
    // Se o root estiver vazio ou com o status pending após 8s, forçamos UI de erro
    if (root && (root.innerHTML === "" || root.getAttribute('data-watchdog') === "pending")) {
      console.error('[Watchdog] Tela branca detectada. Forçando UI de recuperação.');
      injectWatchdogUI(root);
    }
  }, 8000);
})();

const initApp = async () => {
  const rootElement = document.getElementById("root");
  if (!rootElement) return;

  try {
    // Definimos o watchdog como pendente antes de qualquer import
    rootElement.setAttribute('data-watchdog', 'pending');
    
    const { default: App } = await import("./App.tsx");
    const root = createRoot(rootElement);
    
    // Sucesso parcial: o React começou a renderizar
    rootElement.setAttribute('data-watchdog', 'rendering');
    
    root.render(<App />);
    
    // Limpamos o watchdog assim que o React assume o controle
    setTimeout(() => {
      if (watchdog) clearTimeout(watchdog);
      rootElement.setAttribute('data-watchdog', 'ready');
    }, 500);
  } catch (error: any) {
    console.error('[App] Erro crítico na inicialização:', error);
    const msg = error?.message || "Erro desconhecido ao carregar módulos do sistema.";
    injectWatchdogUI(rootElement, `Erro crítico: ${msg}. Isso geralmente é resolvido limpando o cache.`);
  }
};

void initApp();
