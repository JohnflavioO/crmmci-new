import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SANCO_API_URL =
  "http://170.82.192.22:9999/escalasoft/armazem/producao/estoquemercadoria?cnpj=0550239000020";

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

    // Fetch from Sanco API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let sancoResponse;
    try {
      sancoResponse = await fetch(SANCO_API_URL, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.error("Sanco API fetch error:", fetchErr);
      return new Response(
        JSON.stringify({
          error: "API do armazém Sanco indisponível. Tente novamente mais tarde.",
          timestamp: new Date().toISOString(),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    clearTimeout(timeout);

    if (!sancoResponse.ok) {
      console.error(`Sanco API returned ${sancoResponse.status}`);
      return new Response(
        JSON.stringify({
          error: `API do armazém Sanco retornou erro (${sancoResponse.status}). Tente novamente.`,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await sancoResponse.json();
    const items = data?.EstoqueMercadoria ?? [];

    return new Response(
      JSON.stringify({
        items,
        total: items.length,
        timestamp: new Date().toISOString(),
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
