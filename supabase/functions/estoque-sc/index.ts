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

const CNPJ = "0550239000020";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build final URL
    const finalUrl = `${SANCO_API_URL}?cnpj=${CNPJ}`;

    // Detailed logging
    console.log("=== ESTOQUE SC - INÍCIO DA CONSULTA ===");
    console.log("URL final:", finalUrl);
    console.log("Query params: cnpj=" + CNPJ);
    console.log("Headers enviados: Accept=application/json");
    console.log("Usuário autenticado:", user.id);

    // Fetch from Sanco API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let sancoResponse;
    const fetchStart = Date.now();
    try {
      sancoResponse = await fetch(finalUrl, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      const elapsed = Date.now() - fetchStart;
      console.error("ERRO de conexão com API Sanco:", fetchErr);
      console.error("Tempo decorrido:", elapsed, "ms");
      return new Response(
        JSON.stringify({
          error: "API do armazém Sanco indisponível. Tente novamente mais tarde.",
          debug: {
            url_chamada: finalUrl,
            cnpj: CNPJ,
            erro: "Conexão falhou ou timeout",
            tempo_ms: elapsed,
          },
          timestamp: new Date().toISOString(),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    clearTimeout(timeout);
    const elapsed = Date.now() - fetchStart;

    console.log("Status HTTP retornado:", sancoResponse.status);
    console.log("Tempo de resposta:", elapsed, "ms");

    // Read raw body
    const rawBody = await sancoResponse.text();
    console.log("Tamanho body bruto:", rawBody.length, "bytes");
    console.log("Body bruto (primeiros 500 chars):", rawBody.substring(0, 500));

    if (!sancoResponse.ok) {
      console.error(`API Sanco retornou erro HTTP ${sancoResponse.status}`);
      console.error("Body de erro:", rawBody.substring(0, 1000));
      return new Response(
        JSON.stringify({
          error: `API do armazém Sanco retornou erro (${sancoResponse.status}). Tente novamente.`,
          debug: {
            url_chamada: finalUrl,
            cnpj: CNPJ,
            status_http: sancoResponse.status,
            body_erro: rawBody.substring(0, 500),
            tempo_ms: elapsed,
          },
          timestamp: new Date().toISOString(),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse JSON
    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("Erro ao parsear JSON:", parseErr);
      console.error("Body não é JSON válido:", rawBody.substring(0, 500));
      return new Response(
        JSON.stringify({
          error: "Resposta da API Sanco não é JSON válido.",
          debug: {
            url_chamada: finalUrl,
            cnpj: CNPJ,
            body_bruto: rawBody.substring(0, 500),
            tempo_ms: elapsed,
          },
          timestamp: new Date().toISOString(),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const items = data?.EstoqueMercadoria ?? [];

    // Log detalhado sobre resultado
    console.log("=== RESULTADO ===");
    console.log("Total de itens retornados:", items.length);
    console.log("Chaves no objeto raiz:", Object.keys(data));
    if (items.length === 0) {
      console.warn("⚠️ RETORNO VAZIO - A API respondeu com 0 itens.");
      console.warn("Possíveis causas:");
      console.warn("  1. CNPJ sem estoque no armazém Sanco");
      console.warn("  2. Parâmetro CNPJ incorreto");
      console.warn("  3. Estoque zerado neste momento");
    } else {
      console.log("Primeiro item (amostra):", JSON.stringify(items[0]).substring(0, 300));
    }
    console.log("=== FIM DA CONSULTA ===");

    return new Response(
      JSON.stringify({
        items,
        total: items.length,
        timestamp: new Date().toISOString(),
        debug: {
          url_chamada: finalUrl,
          cnpj: CNPJ,
          status_http: sancoResponse.status,
          tempo_ms: elapsed,
          itens_retornados: items.length,
          chaves_resposta: Object.keys(data),
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({
        error: "Erro interno ao consultar estoque.",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
