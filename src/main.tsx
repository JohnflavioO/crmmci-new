import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log('[Main] Inciando renderização...');

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
