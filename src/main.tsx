import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Watchdog UI injection for early recovery
const injectWatchdogUI = (root: HTMLElement) => {
  root.innerHTML = `
    <div id="watchdog-ui" style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f2b26; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
      <div style="max-width: 400px;">
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h1 style="font-size: 24px; margin-bottom: 16px; font-weight: bold;">Erro de Carregamento</h1>
        <p style="opacity: 0.7; margin-bottom: 24px; line-height: 1.5;">O sistema demorou muito para iniciar. Isso pode ser um problema de cache ou conexão.</p>
        <button id="recovery-btn" style="background: #10b981; color: white; border: none; padding: 14px 24px; border-radius: 12px; cursor: pointer; font-weight: bold; width: 100%; font-size: 16px;">
          Limpar Cache e Reiniciar
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('recovery-btn')?.addEventListener('click', () => {
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(n => caches.delete(n)));
    }
    window.location.reload();
  });
};

const startWatchdog = () => {
  if (typeof window === 'undefined') return;

  return setTimeout(() => {
    const root = document.getElementById("root");
    // Se o root estiver vazio ou com o status pending após 10s, forçamos UI de erro
    if (root && (root.innerHTML === "" || root.getAttribute('data-watchdog') === "pending")) {
      console.error('[Watchdog] Tela branca detectada. Forçando UI de recuperação.');
      injectWatchdogUI(root);
    }
  }, 10000);
};

const watchdog = startWatchdog();

const initApp = () => {
  const rootElement = document.getElementById("root");
  if (!rootElement) return;

  try {
    const root = createRoot(rootElement);
    root.render(<App />);
    
    // Sucesso parcial: o React começou a renderizar
    rootElement.setAttribute('data-watchdog', 'rendering');
    
    // Limpamos o watchdog assim que o React assume o controle
    setTimeout(() => {
      clearTimeout(watchdog);
      rootElement.setAttribute('data-watchdog', 'ready');
    }, 1000);
  } catch (error) {
    console.error('[App] Erro crítico na inicialização:', error);
    injectWatchdogUI(rootElement);
  }
};

initApp();
