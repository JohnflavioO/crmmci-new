import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-3-flash-preview';

interface CandidateRow {
  id: string;
  name: string;
  brand: string | null;
  code: string | null;
  sku: string | null;
  category_principal: string | null;
  description: string | null;
  price: number | null;
  image_url: string | null;
  compatibility: string | null;
  score?: number;
}

interface ExtractedSpecs {
  brand?: string;
  model?: string;
  category?: string;
  type?: string;
  specs?: Record<string, string>;
}

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h.endsWith('.local')) return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}

async function callAI(system: string, user: string, apiKey: string): Promise<string> {
  const resp = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (resp.status === 429) throw new Error('AI_RATE_LIMIT');
  if (resp.status === 402) throw new Error('AI_CREDITS');
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`AI_ERROR:${resp.status}:${txt.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? '{}';
}

async function scrapeUrl(url: string): Promise<ExtractedSpecs & { title?: string; description?: string; image?: string }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MCI-CRM/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = (await resp.text()).slice(0, 500000);
    const meta = (prop: string) => {
      const rx = new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
      return html.match(rx)?.[1] ?? '';
    };
    const title = meta('og:title') || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? '').trim();
    const description = meta('og:description') || meta('description');
    const image = meta('og:image');
    const brand = meta('product:brand') || meta('og:brand');
    return { title, description, image, brand };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const started = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claims.claims.sub;

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI não configurado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const input: string = (body?.input ?? '').toString().trim();
    if (!input || input.length > 2000) {
      return new Response(JSON.stringify({ error: 'Entrada inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let mode: 'url' | 'text' = 'text';
    let extracted: ExtractedSpecs & { title?: string; description?: string; image?: string; source_url?: string } = {};
    let urlObj: URL | null = null;

    if (/^https?:\/\//i.test(input)) {
      try {
        urlObj = new URL(input);
      } catch {
        return new Response(JSON.stringify({ error: 'URL inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!['http:', 'https:'].includes(urlObj.protocol) || isPrivateHost(urlObj.hostname)) {
        return new Response(JSON.stringify({ error: 'URL não permitida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      mode = 'url';
    }

    // Cache lookup
    const hashSource = mode === 'url' ? urlObj!.toString() : input.toLowerCase();
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(hashSource));
    const inputHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: cached } = await supabase
      .from('equivalence_search_cache')
      .select('extracted_specs, candidates, expires_at')
      .eq('input_hash', inputHash)
      .maybeSingle();

    if (cached && new Date(cached.expires_at as string).getTime() > Date.now() && body?.force_refresh !== true) {
      return new Response(JSON.stringify({ cached: true, extracted: cached.extracted_specs, results: cached.candidates, response_time_ms: Date.now() - started }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If URL, check approved equivalences first
    if (mode === 'url') {
      const { data: approved } = await supabase
        .from('product_equivalences')
        .select('mci_product_id, confidence, notes')
        .eq('url_externa', urlObj!.toString())
        .order('confidence', { ascending: false })
        .limit(3);
      if (approved && approved.length > 0) {
        const ids = approved.map((a) => a.mci_product_id);
        const { data: prods } = await supabase.from('products').select('*').in('id', ids);
        const results = (prods ?? []).map((p) => ({
          product: p,
          compatibility: approved.find((a) => a.mci_product_id === p.id)?.confidence ?? 95,
          reasons: ['Equivalência aprovada anteriormente por um vendedor'],
          similarities: [],
          differences: [],
          pros: [],
          cons: [],
          approved: true,
        }));
        return new Response(JSON.stringify({ approved_match: true, results, extracted: { source_url: urlObj!.toString() }, response_time_ms: Date.now() - started }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Extract specs
    if (mode === 'url') {
      try {
        const scraped = await scrapeUrl(urlObj!.toString());
        extracted = { ...scraped, source_url: urlObj!.toString() };
      } catch (e: any) {
        return new Response(JSON.stringify({ error: 'Não foi possível ler a URL informada.', detail: String(e?.message ?? e) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Use AI to normalize into specs (brand, model, category, type)
    const extractSystem =
      'Você é um assistente que identifica equipamentos de foto/vídeo/áudio/iluminação. Responda APENAS em JSON válido no formato: {"brand": string, "model": string, "category": string, "type": string, "keywords": string[]}. Nunca invente. Se não souber, use string vazia.';
    const extractUser = mode === 'url'
      ? `Extraia dados do produto abaixo:\nTítulo: ${extracted.title ?? ''}\nDescrição: ${extracted.description ?? ''}\nMarca (meta): ${extracted.brand ?? ''}\nURL: ${urlObj!.toString()}`
      : `Extraia dados do texto do cliente: "${input}"`;
    let normalized: { brand?: string; model?: string; category?: string; type?: string; keywords?: string[] } = {};
    try {
      const raw = await callAI(extractSystem, extractUser, apiKey);
      normalized = JSON.parse(raw);
    } catch (e: any) {
      if (e.message === 'AI_RATE_LIMIT') return new Response(JSON.stringify({ error: 'Limite de requisições da IA atingido. Tente novamente em instantes.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (e.message === 'AI_CREDITS') return new Response(JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos no workspace.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      console.error('AI extract error', e);
    }
    extracted = { ...extracted, ...normalized };

    // Approved equivalences by brand+model
    if (normalized.brand && normalized.model) {
      const { data: approved } = await supabase
        .from('product_equivalences')
        .select('mci_product_id, confidence')
        .ilike('marca_externa', normalized.brand)
        .ilike('modelo_externo', normalized.model)
        .order('confidence', { ascending: false })
        .limit(3);
      if (approved && approved.length > 0) {
        const ids = approved.map((a) => a.mci_product_id);
        const { data: prods } = await supabase.from('products').select('*').in('id', ids);
        const results = (prods ?? []).map((p) => ({
          product: p,
          compatibility: approved.find((a) => a.mci_product_id === p.id)?.confidence ?? 95,
          reasons: ['Equivalência aprovada anteriormente'],
          similarities: [], differences: [], pros: [], cons: [], approved: true,
        }));
        return new Response(JSON.stringify({ approved_match: true, results, extracted, response_time_ms: Date.now() - started }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Pre-filter candidates
    const query = [normalized.brand, normalized.model, normalized.type].filter(Boolean).join(' ') || extracted.title || input;
    const { data: candidates, error: candErr } = await supabase.rpc('search_product_candidates', {
      p_query: query,
      p_brand: normalized.brand ?? null,
      p_category: normalized.category ?? null,
      p_limit: 20,
    });
    if (candErr) console.error('candidate rpc error', candErr);

    const candidateList = (candidates ?? []) as CandidateRow[];
    if (candidateList.length === 0) {
      const payload = { extracted, results: [], message: 'Não encontramos um equivalente com confiança suficiente.', response_time_ms: Date.now() - started };
      await supabase.from('equivalence_search_cache').upsert({ input_hash: inputHash, input_type: mode, input_value: input, extracted_specs: extracted, candidates: [] }, { onConflict: 'input_hash' });
      await supabase.from('equivalence_search_history').insert({ user_id: userId, input_type: mode, input_value: input, extracted_specs: extracted, response_time_ms: Date.now() - started });
      return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Ask AI to rank
    const rankSystem =
      'Você é especialista em equipamentos audiovisuais. Recebe um produto pesquisado e uma lista de candidatos do catálogo MCI. Retorne APENAS JSON no formato: {"results":[{"id":"<uuid do candidato>","compatibility":0-100,"reasons":[string],"similarities":[string],"differences":[string],"pros":[string],"cons":[string]}]}. Escolha até 3 candidatos ordenados por compatibilidade descendente. Se nenhum for realmente equivalente, retorne results vazio. Nunca invente produtos que não estejam na lista.';
    const rankUser = JSON.stringify({
      pesquisado: {
        marca: normalized.brand,
        modelo: normalized.model,
        categoria: normalized.category,
        tipo: normalized.type,
        titulo: extracted.title,
        descricao: extracted.description,
        entrada_original: input,
      },
      candidatos: candidateList.map((c) => ({
        id: c.id,
        name: c.name,
        brand: c.brand,
        code: c.code,
        sku: c.sku,
        category: c.category_principal,
        description: (c.description ?? '').slice(0, 400),
        compatibility_notes: c.compatibility,
      })),
    });

    let ranking: { results: Array<{ id: string; compatibility: number; reasons?: string[]; similarities?: string[]; differences?: string[]; pros?: string[]; cons?: string[] }> } = { results: [] };
    try {
      const raw = await callAI(rankSystem, rankUser, apiKey);
      ranking = JSON.parse(raw);
      if (!Array.isArray(ranking.results)) ranking.results = [];
    } catch (e: any) {
      if (e.message === 'AI_RATE_LIMIT') return new Response(JSON.stringify({ error: 'Limite de IA atingido, tente novamente.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (e.message === 'AI_CREDITS') return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      console.error('AI rank error', e);
    }

    const byId = new Map(candidateList.map((c) => [c.id, c]));
    const results = ranking.results
      .filter((r) => byId.has(r.id))
      .slice(0, 3)
      .map((r) => ({
        product: byId.get(r.id),
        compatibility: Math.max(0, Math.min(100, Math.round(Number(r.compatibility) || 0))),
        reasons: r.reasons ?? [],
        similarities: r.similarities ?? [],
        differences: r.differences ?? [],
        pros: r.pros ?? [],
        cons: r.cons ?? [],
        approved: false,
      }))
      .filter((r) => r.compatibility >= 60);

    const responseTime = Date.now() - started;

    await supabase.from('equivalence_search_cache').upsert({
      input_hash: inputHash,
      input_type: mode,
      input_value: input,
      extracted_specs: extracted,
      candidates: results,
    }, { onConflict: 'input_hash' });

    await supabase.from('equivalence_search_history').insert({
      user_id: userId,
      input_type: mode,
      input_value: input,
      extracted_specs: extracted,
      response_time_ms: responseTime,
    });

    const message = results.length === 0 ? 'Não encontramos um equivalente com confiança suficiente.' : undefined;
    return new Response(JSON.stringify({ extracted, results, message, response_time_ms: responseTime }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('find-equivalent-product error', e);
    return new Response(JSON.stringify({ error: 'Erro interno', detail: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
