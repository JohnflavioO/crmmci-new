import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * MONITOR DE TELA BRANCA (WATCHDOG)
 * O Lovable Preview pode ocasionalmente falhar ao carregar o bundle JS ou ter problemas de cache.
 * Este watchdog garante que, se nada for renderizado em 8 segundos, o usuário tenha uma opção de recuperação.
 */
const startWatchdog = () => {
  if (typeof window === 'undefined') return;

  const watchdogTimer = setTimeout(() => {
    const root = document.getElementById("root");
    // Se o root estiver vazio ou contiver apenas o esqueleto inicial (se houver), algo deu errado
    if (root && (root.innerHTML === "" || root.innerHTML.includes('data-watchdog="pending"'))) {
      console.error('[Watchdog] Tela branca detectada após 8 segundos.');
      
      // Tenta uma recuperação suave limpando o estado do auth se estiver em loop
      const errorCount = parseInt(sessionStorage.getItem('app_error_count') || '0');
      if (errorCount < 2) {
        sessionStorage.setItem('app_error_count', (errorCount + 1).toString());
        console.log('[Watchdog] Tentando recarregamento automático...');
        window.location.reload();
        return;
      }

      // Se falhar repetidamente, mostra UI de recuperação manual
      root.innerHTML = `
        <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f2b26; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
          <div style="max-width: 400px; animation: fadeIn 0.5s ease-out;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h1 style="font-size: 24px; margin-bottom: 16px; font-weight: bold;">Erro de Carregamento</h1>
            <p style="opacity: 0.7; margin-bottom: 24px; line-height: 1.5;">O sistema encontrou uma falha crítica ao carregar os recursos necessários.</p>
            <button id="recovery-btn" style="background: #10b981; color: white; border: none; padding: 14px 24px; border-radius: 12px; cursor: pointer; font-weight: bold; width: 100%; font-size: 16px; transition: transform 0.2s;">
              Limpar Cache e Reiniciar
            </button>
            <p style="margin-top: 20px; font-size: 11px; opacity: 0.4;">ID do Erro: ${Date.now()}</p>
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
    }
  }, 8000);

  return watchdogTimer;
};

const watchdog = startWatchdog();

// Logger de inicialização para auxiliar debug via console
console.log('[App] Renderizando aplicação...', {
  timestamp: new Date().toISOString(),
  ua: navigator.userAgent
});

const rootElement = document.getElementById("root");
if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(<App />);
    
    // Se chegou aqui e o render foi disparado, cancelamos o watchdog 
    // após um pequeno delay para garantir que o primeiro frame apareceu
    setTimeout(() => {
      clearTimeout(watchdog);
      sessionStorage.removeItem('app_error_count');
    }, 1000);
  } catch (error) {
    console.error('[App] Erro fatal na inicialização do React:', error);
  }
}
