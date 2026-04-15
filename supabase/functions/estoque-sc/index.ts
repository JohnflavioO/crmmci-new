import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Endpoint confirmado via teste direto — /producao/ é o path válido (não /ordem/)
// O servidor api.escalasoft.com.br NÃO hospeda esse endpoint (retorna 404)
// O servidor real é o IP direto do armazém Sanco
const SANCO_API_URL =
  "http://170.82.192.22:9999/escalasoft/armazem/producao/estoquemercadoria";

const CNPJ = "05502390000200";
const SANCO_TIMEOUT_MS = 30000;
const BODY_LOG_PREVIEW_LENGTH = 1500;

function jsonResponse(body: Record<string, unknown>, status = 200, cacheControl?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(cacheControl ? { "Cache-Control": cacheControl } : {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ ok: false, error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ ok: false, error: "Não autorizado" }, 401);
    }

    // Build final URL
    const finalUrl = `${SANCO_API_URL}?cnpj=${CNPJ}`;
    const externalMethod = "GET";
    const externalHeaders = { Accept: "application/json" };

    // Detailed logging
    console.log("=== ESTOQUE SC - INÍCIO DA CONSULTA ===");
    console.log("URL final:", finalUrl);
    console.log("Método HTTP externo:", externalMethod);
    console.log("Query params: cnpj=" + CNPJ);
    console.log("Headers enviados:", JSON.stringify(externalHeaders));
    console.log("Timeout configurado:", SANCO_TIMEOUT_MS, "ms");
    console.log("Usuário autenticado:", user.id);

    // Fetch from Sanco API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SANCO_TIMEOUT_MS);

    let sancoResponse;
    const fetchStart = Date.now();
    try {
      sancoResponse = await fetch(finalUrl, {
        method: externalMethod,
        signal: controller.signal,
        headers: externalHeaders,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      const elapsed = Date.now() - fetchStart;
      console.error("ERRO de conexão com API Sanco:", fetchErr);
      console.error("Tempo decorrido:", elapsed, "ms");
      return jsonResponse({
        ok: false,
        error: "API do armazém Sanco indisponível. Tente novamente mais tarde.",
        diagnostics: {
          linha_erro: fetchErr instanceof Error ? fetchErr.stack?.split("\n")[1]?.trim() ?? null : null,
          url_chamada: finalUrl,
          metodo_http: externalMethod,
          query_params: { cnpj: CNPJ },
          headers_enviados: externalHeaders,
          erro: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
          tempo_ms: elapsed,
        },
        timestamp: new Date().toISOString(),
      });
    }
    clearTimeout(timeout);
    const elapsed = Date.now() - fetchStart;

    console.log("Status HTTP retornado:", sancoResponse.status);
    console.log("Tempo de resposta:", elapsed, "ms");

    // Read raw body
    const rawBody = await sancoResponse.text();
    console.log("Tamanho body bruto:", rawBody.length, "bytes");
    console.log(
      "Body bruto (primeiros 1500 chars):",
      rawBody.substring(0, BODY_LOG_PREVIEW_LENGTH)
    );

    if (!sancoResponse.ok) {
      console.error(`API Sanco retornou erro HTTP ${sancoResponse.status}`);
      console.error("Body de erro:", rawBody.substring(0, 1000));
      return jsonResponse({
        ok: false,
        error: `API do armazém Sanco retornou erro (${sancoResponse.status}). Tente novamente.`,
        diagnostics: {
          url_chamada: finalUrl,
          metodo_http: externalMethod,
          query_params: { cnpj: CNPJ },
          headers_enviados: externalHeaders,
          status_http: sancoResponse.status,
          body_bruto: rawBody,
          tempo_ms: elapsed,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Parse JSON
    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("Erro ao parsear JSON:", parseErr);
      console.error("Body não é JSON válido:", rawBody.substring(0, 500));
      return jsonResponse({
        ok: false,
        error: "Resposta da API Sanco não é JSON válido.",
        diagnostics: {
          linha_erro: parseErr instanceof Error ? parseErr.stack?.split("\n")[1]?.trim() ?? null : null,
          url_chamada: finalUrl,
          metodo_http: externalMethod,
          query_params: { cnpj: CNPJ },
          headers_enviados: externalHeaders,
          body_bruto: rawBody,
          tempo_ms: elapsed,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const items = Array.isArray(data?.EstoqueMercadoria)
      ? data.EstoqueMercadoria
      : Array.isArray(data?.Item)
        ? data.Item
        : data?.Item
          ? [data.Item]
          : Array.isArray(data)
            ? data
            : [];
    const rootKeys = data && typeof data === "object" ? Object.keys(data) : [];
    const detectedFormat = Array.isArray(data)
      ? "array"
      : rootKeys.includes("EstoqueMercadoria")
        ? "EstoqueMercadoria"
        : rootKeys.includes("Item")
          ? "Item"
          : "desconhecido";

    // Log detalhado sobre resultado
    console.log("=== RESULTADO ===");
    console.log("Formato detectado:", detectedFormat);
    console.log("Total de itens retornados:", items.length);
    console.log("Chaves no objeto raiz:", rootKeys);
    if (items.length === 0) {
      console.warn("⚠️ RETORNO VAZIO - A API respondeu com 0 itens.");
      console.warn("Possíveis causas:");
      console.warn("  1. CNPJ sem estoque no armazém Sanco");
      console.warn("  2. Parâmetro CNPJ incorreto");
      console.warn("  3. Formato da resposta diferente do esperado");
      console.warn("  3. Estoque zerado neste momento");
    } else {
      console.log("Primeiro item (amostra):", JSON.stringify(items[0]).substring(0, 300));
    }
    console.log("=== FIM DA CONSULTA ===");

    return jsonResponse(
      {
        ok: true,
        items,
        total: items.length,
        timestamp: new Date().toISOString(),
        debug: {
          url_chamada: finalUrl,
          metodo_http: externalMethod,
          cnpj: CNPJ,
          status_http: sancoResponse.status,
          tempo_ms: elapsed,
          itens_retornados: items.length,
          formato_detectado: detectedFormat,
          chaves_resposta: rootKeys,
        },
      },
      200,
      "public, max-age=300"
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return jsonResponse(
      {
        ok: false,
        error: "Erro interno ao consultar estoque.",
        diagnostics: {
          linha_erro: err instanceof Error ? err.stack?.split("\n")[1]?.trim() ?? null : null,
          stack: err instanceof Error ? err.stack : String(err),
        },
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});
