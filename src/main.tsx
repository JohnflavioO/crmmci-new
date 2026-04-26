import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Guard: never register service worker in Lovable preview/iframe
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app");

if (isPreviewHost || isInIframe) {
  console.log('[Preview] Preview environment detected, cleaning up...');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) {
        reg.unregister();
      }
    });
  }
  // Clear caches to prevent SW interference
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) caches.delete(name);
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
