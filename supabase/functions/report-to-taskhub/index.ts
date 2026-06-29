// Edge Function: report-to-taskhub
// Bridge to forward reports from any Lovable product to TaskHub.

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
    return false;
  } catch {
    return true;
  }
};

/**
 * Builds the final endpoint URL.
 * Spec: POST /api/integrations/crm-mci/cards
 * Accepts either a base URL (https://taskhub.app) OR a full endpoint already
 * containing /api/integrations/<slug>/cards (or legacy /api/public/integrations/<slug>/issues).
 */
function buildEndpoint(apiUrl: string, sourceApp: string): string {
  const trimmed = apiUrl.replace(/\/+$/, "");
  const slug = (sourceApp || "crm-mci").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (/\/api\/integrations\/[^/]+\/cards$/i.test(trimmed)) return trimmed;
  if (/\/api\/public\/integrations\/[^/]+\/issues$/i.test(trimmed)) return trimmed;
  if (/\/api\/integrations\/?$/i.test(trimmed)) {
    return `${trimmed.replace(/\/$/, "")}/${slug}/cards`;
  }
  return `${trimmed}/api/integrations/${slug}/cards`;
}

async function forwardWithRetry(url: string, key: string, body: unknown) {
  let lastErr: { status?: number; message: string; body?: string } | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[taskhub] attempt ${attempt}/${MAX_RETRIES} POST ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Api-Key": key,
          "X-Integration-Source": "lovable-taskhub-bridge",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      const contentType = res.headers.get("content-type") || "";
      let parsed: unknown = text;
      let isJson = false;
      if (contentType.includes("application/json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
        try { parsed = JSON.parse(text); isJson = true; } catch { /* keep text */ }
      }

      console.log(`[taskhub] response status=${res.status} content-type=${contentType} body=${text.slice(0, 1000)}`);

      if (res.ok && isJson) {
        return { ok: true as const, status: res.status, data: parsed, attempts: attempt };
      }
      // 200 but HTML/non-JSON => endpoint wrong (hit a SPA, not the API)
      if (res.ok && !isJson) {
        return {
          ok: false as const,
          status: res.status,
          data: { error: "endpoint_returned_non_json", message: "TaskHub endpoint retornou HTML/texto em vez de JSON. Verifique se TASKHUB_API_URL aponta para a API real do TaskHub.", preview: text.slice(0, 300) },
          attempts: attempt,
          retryable: false,
        };
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
        "Integração TaskHub ainda não ativa (URL/Key não configurados). Solicitação registrada apenas localmente.",
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

  const tipoMap: Record<string, string> = {
    bug: "bug",
    improvement: "melhoria",
    idea: "ideia",
    request: "solicitacao",
  };
  const prioridadeMap: Record<string, string> = {
    low: "baixa",
    medium: "media",
    high: "alta",
    urgent: "urgente",
  };

  const forwarded = {
    // Spec fields (pt-BR)
    tipo: tipoMap[body.type] ?? body.type,
    prioridade: prioridadeMap[body.priority ?? "medium"] ?? body.priority ?? "media",
    titulo: String(body.title).trim(),
    descricao: String(body.description).trim(),
    modulo: body.module ?? ctx.module ?? null,
    url: ctx.page_url ?? null,
    usuario: {
      id: ctx.user_id ?? null,
      nome: ctx.user_name ?? null,
      email: ctx.user_email ?? null,
      role: ctx.user_role ?? null,
    },
    versao_crm: ctx.app_version ?? null,
    anexos: body.attachments ?? [],

    // Back-compat fields
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

  const endpoint = buildEndpoint(apiUrl, body.source_app);

  console.log(`[taskhub] endpoint=${endpoint}`);
  console.log(`[taskhub] payload=${JSON.stringify({ ...forwarded, attachments: `[${forwarded.attachments.length} files]` })}`);

  const result = await forwardWithRetry(endpoint, apiKey, forwarded);

  // Upstream unreachable -> degrade to mock
  if (!result.ok && result.status === 0) {
    const msg = typeof result.data === "string" ? result.data : JSON.stringify(result.data);
    if (/dns error|failed to lookup|ENOTFOUND|ECONNREFUSED|Connect/i.test(msg)) {
      console.warn("[taskhub] upstream unreachable, degrading to mock");
      return json(200, {
        ok: true,
        mock: true,
        message: "TaskHub inacessível. Solicitação registrada localmente.",
        upstream_response: msg,
      });
    }
  }

  if (result.ok) {
    const data: any = result.data;
    const cardId =
      data?.card_id ||
      data?.id ||
      data?.issue_id ||
      data?.data?.card_id ||
      data?.data?.id ||
      null;

    const explicitSuccess = data?.success === true || data?.ok === true;

    if (!cardId && !explicitSuccess) {
      console.error(`[taskhub] 2xx sem card_id: ${JSON.stringify(data).slice(0, 500)}`);
      return json(502, {
        ok: false,
        error: "taskhub_not_created",
        message:
          (data && (data.message || data.error)) ||
          "TaskHub respondeu 2xx mas não retornou card_id. Card não foi criado.",
        endpoint,
        upstream_response: data,
      });
    }

    return json(200, {
      ok: true,
      card_id: cardId,
      taskhub: data,
      endpoint,
      attempts: result.attempts,
    });
  }

  let upstreamMessage = typeof result.data === "string" ? result.data : "";
  if (result.data && typeof result.data === "object") {
    const d: any = result.data;
    upstreamMessage = d.message || d.error || JSON.stringify(d);
  }

  return json(502, {
    ok: false,
    error: "taskhub_forward_failed",
    message: `Falha ao criar card no TaskHub: ${upstreamMessage}`,
    endpoint,
    upstream_status: result.status,
    upstream_response: result.data,
    attempts: result.attempts,
  });
});
