// Rescue loader for stale Lovable/Vite preview HTML shells.
// Older preview documents in the browser can still request removed entry files
// such as /assets/index.js or /assets/index-*.js. This module never contains the
// app bundle; it discovers the current HTML entry and imports that fresh file.

const showRecoveryError = (error) => {
  const root = document.getElementById("root") || document.body;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  root.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f2b26;color:white;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px">
      <section style="max-width:560px;text-align:center;display:grid;gap:14px">
        <h1 style="font-size:22px;margin:0">MCI CRM não iniciou no preview</h1>
        <p style="margin:0;color:rgba(255,255,255,.72);font-size:14px;line-height:1.5">O navegador tentou abrir uma versão antiga do app. Atualize o preview pelo editor para buscar a entrada atual.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;text-align:left;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px;font-size:11px;color:#fecaca;max-height:140px;overflow:auto">${message.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]))}</pre>
      </section>
    </main>
  `;
};

const installDevRuntime = async () => {
  try {
    const RefreshRuntime = await import("/@react-refresh");
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    await import("/@vite/client");
  } catch (_) {
    // Production/remote preview does not expose Vite dev endpoints.
  }
};

const getCurrentEntryFromHtml = async () => {
  const response = await fetch(`/?__mci_entry_probe=${Date.now()}`, { cache: "reload" });
  if (!response.ok) throw new Error(`Falha ao buscar HTML atual: HTTP ${response.status}`);
  const html = await response.text();
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter(Boolean)
    .filter((src) => !/\/assets\/(?:recover-stale-entry|index(?:-[A-Za-z0-9_]+)?)\.js(?:$|[?#])/i.test(src));
  const entry = scripts[0];
  if (!entry) throw new Error("HTML atual não contém entrada JavaScript nova do app.");
  return new URL(entry, window.location.origin).toString();
};

const boot = async () => {
  const host = window.location.hostname;
  const isViteDev = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";

  if (isViteDev) {
    await installDevRuntime();
    await import(`/src/main.tsx?__mci_stale_recover=${Date.now()}`);
    return;
  }

  const entry = await getCurrentEntryFromHtml();
  const url = new URL(entry);
  url.searchParams.set("__mci_stale_recover", String(Date.now()));
  await import(url.toString());
};

boot().catch(showRecoveryError);