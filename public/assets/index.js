// Permanent compatibility shim for stale Lovable/Vite HTML shells.
// Some returning preview sessions can keep an old HTML document that tries to
// load /assets/index.js. In dev preview that file is not emitted by Vite, so the
// app never boots. This shim finds the current entry and imports it with a cache
// buster instead of leaving the page blank.

const showRecoveryError = (error) => {
  const root = document.getElementById("root") || document.body;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  root.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f2b26;color:white;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px">
      <section style="max-width:520px;text-align:center;display:grid;gap:14px">
        <h1 style="font-size:22px;margin:0">MCI CRM não iniciou no preview</h1>
        <p style="margin:0;color:rgba(255,255,255,.72);font-size:14px;line-height:1.5">Removi uma referência antiga do cache. Clique para recarregar sem cache.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;text-align:left;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px;font-size:11px;color:#fecaca;max-height:120px;overflow:auto">${message.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]))}</pre>
        <button id="mci-shim-reload" style="border:0;border-radius:10px;padding:12px 14px;background:#059669;color:white;font-weight:700;cursor:pointer">Recarregar preview</button>
      </section>
    </main>
  `;
  document.getElementById("mci-shim-reload")?.addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("__mci_reload", String(Date.now()));
    window.location.replace(url.toString());
  });
};

const getCurrentEntryFromHtml = async () => {
  const response = await fetch(`/?__mci_entry_probe=${Date.now()}`, { cache: "reload" });
  if (!response.ok) throw new Error(`Falha ao buscar HTML atual: HTTP ${response.status}`);
  const html = await response.text();
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter(Boolean);
  const entry = scripts.find((src) => !/\/assets\/index\.js(?:$|[?#])/i.test(src)) || scripts[0];
  if (!entry) throw new Error("HTML atual não contém entrada JavaScript do app.");
  return new URL(entry, window.location.origin).toString();
};

const boot = async () => {
  const host = window.location.hostname;
  const isViteDev = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  if (isViteDev) {
    try {
      const RefreshRuntime = await import("/@react-refresh");
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      await import("/@vite/client");
    } catch (_) {
      // In production these dev-only endpoints do not exist; continue normally.
    }
  }
  const entry = isViteDev ? "/src/main.tsx" : await getCurrentEntryFromHtml();
  const url = new URL(entry, window.location.origin);
  url.searchParams.set("__mci_entry_reload", String(Date.now()));
  await import(url.toString());
};

boot().catch(showRecoveryError);