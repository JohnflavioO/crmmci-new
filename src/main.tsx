import {
  clearBrowserCachesAndWorkers,
  installBrowserSafetyGuards,
  isLikelyChunkLoadError,
  reloadWithCacheBust,
  shouldRetryChunkLoad,
} from "@/lib/browserRecovery";
import { createRoot } from "react-dom/client";
import "./index.css";

if (import.meta.env.DEV) console.log('[Main] Inciando renderização...');

const isPreviewRuntime = () => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return window.self !== window.top
    || h.startsWith('id-preview--')
    || h.includes('-preview--')
    || h.endsWith('.lovableproject.com')
    || h.endsWith('.lovableproject-dev.com')
    || h.endsWith('.beta.lovable.dev');
};

const safeReload = () => {
  if (isPreviewRuntime()) {
    reloadWithCacheBust();
    return;
  }
  window.location.reload();
};

const recoverChunkStartupError = (error: unknown) => {
  if (!isLikelyChunkLoadError(error) || !shouldRetryChunkLoad()) return false;
  void clearBrowserCachesAndWorkers().finally(() => reloadWithCacheBust());
  return true;
};

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  return entities[char] ?? char;
});

const renderFatalStartupError = (error: unknown) => {
  const rootElement = document.getElementById("root");
  if (!rootElement) return;

  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  rootElement.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f2b26;color:white;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;">
      <section style="max-width:520px;width:100%;text-align:center;display:grid;gap:16px;">
        <h1 style="font-size:22px;font-weight:700;margin:0;">MCI CRM não iniciou corretamente</h1>
        <p style="margin:0;color:rgba(255,255,255,.72);font-size:14px;line-height:1.5;">Recarregue a página. Se persistir, use a limpeza segura abaixo.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;text-align:left;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px;font-size:11px;color:#fecaca;max-height:160px;overflow:auto;">${escapeHtml(message)}</pre>
        <div style="display:grid;gap:10px;">
          <button id="mci-reload" style="border:0;border-radius:10px;padding:12px 14px;background:#059669;color:white;font-weight:700;cursor:pointer;">Recarregar sistema</button>
          <button id="mci-clean" style="border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:12px 14px;background:rgba(255,255,255,.08);color:white;font-weight:700;cursor:pointer;">Limpar cache local</button>
        </div>
      </section>
    </main>
  `;

  document.getElementById("mci-reload")?.addEventListener("click", safeReload);
  document.getElementById("mci-clean")?.addEventListener("click", () => {
    try { window.localStorage.clear(); } catch {}
    try { window.sessionStorage.clear(); } catch {}
    safeReload();
  });
};

if (typeof window !== 'undefined') {
  installBrowserSafetyGuards();
  window.addEventListener('error', (event) => {
    console.error('[Main] Erro global:', event.error ?? event.message);
    if (recoverChunkStartupError(event.error ?? event.message)) {
      event.preventDefault?.();
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Main] Promessa rejeitada:', event.reason);
    if (recoverChunkStartupError(event.reason)) {
      event.preventDefault?.();
    }
  });
}


async function startApp() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error('[Main] Elemento root não encontrado!');
    return;
  }

  console.log('[Main] Elemento root encontrado');
  const { default: App } = await import("./App.tsx");
  const root = createRoot(rootElement);
  root.render(<App />);
  window.__mciReactMounted = true;
  console.log('[Main] Renderização solicitada');
}

declare global {
  interface Window {
    __mciReactMounted?: boolean;
  }
}

try {
  installBrowserSafetyGuards();
  void startApp().catch((error) => {
    console.error('[Main] Erro fatal durante a inicialização assíncrona:', error);
    if (recoverChunkStartupError(error)) return;
    renderFatalStartupError(error);
  });
} catch (error) {
  console.error('[Main] Erro fatal durante a renderização:', error);
  if (recoverChunkStartupError(error)) {
    // A recuperação já agendou limpeza + reload.
  } else {
  renderFatalStartupError(error);
  }
}
