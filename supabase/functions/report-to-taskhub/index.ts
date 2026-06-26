// Edge Function: report-to-taskhub
// Reusable integration endpoint to forward reports (bug / improvement / idea / request)
// from ANY Lovable product (MCI CRM, FlowChat, ProCRM, Kontas, MCI Radar...) to TaskHub.
//
// Contract is intentionally generic:
//   POST { type, title, description, priority, module, source_app, context, attachments? }
// Configuration is taken EXCLUSIVELY from environment secrets:
//   - TASKHUB_API_URL   (e.g. https://taskhub.example.com/api/v1/tickets)
//   - TASKHUB_API_KEY   (Bearer token issued by TaskHub)
//
// No product-specific logic lives here. To onboard a new product, just deploy this
// function with those two secrets configured.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface ReportPayload {
  type: "bug" | "improvement" | "idea" | "request";
  title: string;
  description: string;
  priority?: "low" | "medium" | "high" | "critical";
  module?: string;
  source_app: string;
  context?: Record<string, unknown>;
  attachments?: Array<{ name: string; mime: string; data_base64: string }>;
}

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 400;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function isValid(p: any): p is ReportPayload {
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

async function forwardWithRetry(url: string, key: string, body: unknown) {
  let lastErr: { status?: number; message: string } | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "X-Integration-Source": "lovable-taskhub-bridge",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let parsed: unknown = text;
      try { parsed = JSON.parse(text); } catch { /* keep as text */ }

      if (res.ok) {
        return { ok: true as const, status: res.status, data: parsed, attempts: attempt };
      }
      // Retry only on 5xx / 429
      if (res.status >= 500 || res.status === 429) {
        lastErr = { status: res.status, message: typeof parsed === "string" ? parsed : JSON.stringify(parsed) };
      } else {
        return { ok: false as const, status: res.status, data: parsed, attempts: attempt, retryable: false };
      }
    } catch (e) {
      lastErr = { message: (e as Error).message };
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
    }
  }
  return { ok: false as const, status: lastErr?.status ?? 0, data: lastErr?.message ?? "unknown_error", attempts: MAX_RETRIES, retryable: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const apiUrl = Deno.env.get("TASKHUB_API_URL");
  const apiKey = Deno.env.get("TASKHUB_API_KEY");

  if (!apiUrl || !apiKey) {
    // Dev/mock mode — integration is wired but secrets aren't set yet.
    // We return 200 with mock=true so clients log it locally and inform the user.
    return json(200, {
      ok: true,
      mock: true,
      message:
        "Integração com TaskHub ainda não ativa (TASKHUB_API_URL / TASKHUB_API_KEY não configurados). Solicitação registrada apenas localmente.",
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if (!isValid(body)) {
    return json(400, { error: "invalid_payload", message: "Campos obrigatórios: type, title, description, source_app." });
  }

  // Cap attachments size (~5MB total base64 ≈ ~3.75MB binary)
  if (Array.isArray(body.attachments)) {
    const totalBytes = body.attachments.reduce(
      (s: number, a: any) => s + (typeof a?.data_base64 === "string" ? a.data_base64.length : 0),
      0,
    );
    if (totalBytes > 7_000_000) {
      return json(413, { error: "attachments_too_large" });
    }
  }

  const forwarded = {
    type: body.type,
    title: body.title.trim(),
    description: body.description.trim(),
    priority: body.priority ?? "medium",
    module: body.module ?? null,
    source_app: body.source_app,
    context: body.context ?? {},
    attachments: body.attachments ?? [],
    received_at: new Date().toISOString(),
  };

  const result = await forwardWithRetry(apiUrl, apiKey, forwarded);

  if (result.ok) {
    return json(200, { ok: true, taskhub: result.data, attempts: result.attempts });
  }
  return json(502, {
    ok: false,
    error: "taskhub_forward_failed",
    upstream_status: result.status,
    upstream_response: result.data,
    attempts: result.attempts,
  });
});
