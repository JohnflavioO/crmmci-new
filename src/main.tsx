import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";


// 2. Renderização segura com log de inicialização
console.log('[App] Inicializando aplicação...', {
  env: import.meta.env.MODE,
  preview: window.location.hostname.includes('lovable.app'),
  time: new Date().toISOString()
});

const rootElement = document.getElementById("root");
if (rootElement) {
  try {
    createRoot(rootElement).render(<App />);
  } catch (error) {
    console.error('[App] Erro crítico na renderização inicial:', error);
    rootElement.innerHTML = `
      <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f2b26; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
        <div>
          <h1 style="font-size: 24px; margin-bottom: 16px;">Erro ao carregar o sistema</h1>
          <p style="opacity: 0.7; margin-bottom: 24px;">Ocorreu uma falha na inicialização inicial do React.</p>
          <button onclick="window.location.reload()" style="background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold;">Tentar novamente</button>
        </div>
      </div>
    `;
  }
}
