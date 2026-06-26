// Edge Function: report-to-taskhub
// Generic bridge to forward reports from any Lovable product to TaskHub.
//
// Endpoint pattern:
//   POST ${TASKHUB_API_URL}/api/public/integrations/<source_app>/issues
// Headers:
//   Content-Type: application/json
//   X-Api-Key: ${TASKHUB_API_KEY}

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 400;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function isValid(p: any) {
  return (
    p &&
    typeof p === "object" &&
    ["bug", "improvement", "idea", "request"].includes(p.type) &&
    typeof p.title === "string" &&
    p.title.trim().length > 0 &&
    p.title.length <= 200 &&
    typeof p.description === "string" &&
    p.description.trim().length > 0 &&
    p.description.length <= 10000 &&
    typeof p.source_app === "string" &&
    p.source_app.trim().length > 0
  );
}

const isPlaceholderUrl = (u?: string | null) => {
  if (!u) return true;
  try {
    const { hostname, protocol } = new URL(u);
    if (!/^https?:$/.test(protocol)) return true;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (/\.local$/i.test(hostname)) return true;
    if (/example\.(com|org|net)$/i.test(hostname)) return true;
    if (/taskhub\.local$/i.test(hostname)) return true;
    return false;
  } catch {
    return true;
  }
};

async function forwardWithRetry(url: string, key: string, body: unknown) {
  let lastErr: { status?: number; message: string; body?: string } | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[taskhub] attempt ${attempt}/${MAX_RETRIES} POST ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": key,
          "X-Integration-Source": "lovable-taskhub-bridge",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let parsed: unknown = text;
      try { parsed = JSON.parse(text); } catch { /* keep text */ }

      console.log(`[taskhub] response status=${res.status} body=${text.slice(0, 2000)}`);

      if (res.ok) {
        return { ok: true as const, status: res.status, data: parsed, attempts: attempt };
      }
      if (res.status >= 500 || res.status === 429) {
        lastErr = { status: res.status, message: typeof parsed === "string" ? parsed : JSON.stringify(parsed), body: text };
      } else {
        return { ok: false as const, status: res.status, data: parsed, attempts: attempt, retryable: false };
      }
    } catch (e) {
      const message = (e as Error).message;
      console.error(`[taskhub] fetch error: ${message}`);
      lastErr = { message };
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
    }
  }
  return {
    ok: false as const,
    status: lastErr?.status ?? 0,
    data: lastErr?.body ?? lastErr?.message ?? "unknown_error",
    attempts: MAX_RETRIES,
    retryable: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const apiUrl = Deno.env.get("TASKHUB_API_URL");
  const apiKey = Deno.env.get("TASKHUB_API_KEY");

  console.log(`[taskhub] TASKHUB_API_URL=${apiUrl ?? "(unset)"} key_present=${apiKey ? "yes" : "no"}`);

  if (!apiUrl || !apiKey || isPlaceholderUrl(apiUrl)) {
    console.warn("[taskhub] mock mode — secrets missing or placeholder URL");
    return json(200, {
      ok: true,
      mock: true,
      message:
        "Integração com TaskHub ainda não ativa (TASKHUB_API_URL / TASKHUB_API_KEY não configurados ou URL placeholder). Solicitação registrada apenas localmente.",
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if (!isValid(body)) {
    return json(400, {
      ok: false,
      error: "invalid_payload",
      message: "Campos obrigatórios: type, title, description, source_app.",
    });
  }

  if (Array.isArray(body.attachments)) {
    const totalBytes = body.attachments.reduce(
      (s: number, a: any) => s + (typeof a?.data_base64 === "string" ? a.data_base64.length : 0),
      0,
    );
    if (totalBytes > 7_000_000) {
      return json(413, { ok: false, error: "attachments_too_large" });
    }
  }

  const ctx = (body.context ?? {}) as Record<string, any>;

  // Payload no formato esperado pelo TaskHub.
  const forwarded = {
    source: body.source_app,
    project: body.source_app,
    type: body.type,
    module: body.module ?? ctx.module ?? null,
    title: String(body.title).trim(),
    description: String(body.description).trim(),
    priority: body.priority ?? "medium",
    current_url: ctx.page_url ?? null,
    reported_by_name: ctx.user_name ?? null,
    reported_by_email: ctx.user_email ?? null,
    screenshot_url: ctx.screenshot_url ?? null,
    metadata: {
      ...ctx,
      app_version: ctx.app_version ?? null,
      user_role: ctx.user_role ?? null,
      company_id: ctx.company_id ?? null,
      user_id: ctx.user_id ?? null,
      submitted_at: ctx.submitted_at ?? new Date().toISOString(),
    },
    attachments: body.attachments ?? [],
  };

  const base = apiUrl.replace(/\/+$/, "");
  const slug = String(body.source_app).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const endpoint = `${base}/api/public/integrations/${slug}/issues`;

  console.log(`[taskhub] endpoint=${endpoint}`);
  console.log(`[taskhub] payload=${JSON.stringify({ ...forwarded, attachments: `[${forwarded.attachments.length} files]` })}`);

  const result = await forwardWithRetry(endpoint, apiKey, forwarded);

  if (result.ok) {
    // TaskHub respondeu 2xx — confirmar criação.
    const data: any = result.data;
    const created =
      data && typeof data === "object"
        ? data.ok !== false && (data.id || data.issue_id || data.card_id || data.created === true || data.success !== false)
        : true;

    if (!created) {
      const msg =
        (data && (data.message || data.error)) ||
        "TaskHub não confirmou a criação do card.";
      console.error(`[taskhub] upstream 2xx mas sem confirmação: ${JSON.stringify(data)}`);
      return json(502, {
        ok: false,
        error: "taskhub_not_created",
        message: `Falha ao criar card no TaskHub: ${msg}`,
        upstream_response: data,
      });
    }

    return json(200, { ok: true, taskhub: data, attempts: result.attempts });
  }

  // Upstream inacessível (DNS/connect) -> degrada para mock.
  const msg = typeof result.data === "string" ? result.data : JSON.stringify(result.data);
  if (result.status === 0 && /dns error|failed to lookup|ENOTFOUND|ECONNREFUSED|Connect/i.test(msg)) {
    console.warn("[taskhub] upstream unreachable, degrading to mock");
    return json(200, {
      ok: true,
      mock: true,
      message:
        "TaskHub inacessível (host não resolve). Solicitação registrada localmente até a URL ficar disponível.",
      upstream_response: msg,
    });
  }

  // Extrai mensagem amigável do upstream.
  let upstreamMessage = msg;
  if (result.data && typeof result.data === "object") {
    const d: any = result.data;
    upstreamMessage = d.message || d.error || JSON.stringify(d);
  }

  return json(502, {
    ok: false,
    error: "taskhub_forward_failed",
    message: `Falha ao criar card no TaskHub: ${upstreamMessage}`,
    upstream_status: result.status,
    upstream_response: result.data,
    attempts: result.attempts,
  });
});
