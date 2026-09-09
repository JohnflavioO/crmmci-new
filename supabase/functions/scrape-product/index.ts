import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function respond(ok: boolean, payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify({ ok, ...payload }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return respond(false, { error: 'Unauthorized' }, 401);
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      console.error('Auth failed:', authErr?.message);
      return respond(false, { error: 'Unauthorized' }, 401);
    }

    let body: { url?: string };
    try {
      body = await req.json();
    } catch {
      return respond(false, { error: 'Corpo da requisição inválido' }, 400);
    }

    const { url } = body;
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return respond(false, { error: 'URL é obrigatória' }, 400);
    }
    if (url.length > 2000) {
      return respond(false, { error: 'URL muito longa (máximo 2000 caracteres)' }, 400);
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;

    // Validate URL
    try {
      new URL(formattedUrl);
    } catch {
      return respond(false, { error: 'Formato de URL inválido' }, 400);
    }

    const domain = new URL(formattedUrl).hostname;
    console.log(`[scrape] URL: ${formattedUrl} | domain: ${domain}`);

    // Fetch page (direct, then via reader proxy if blocked)
    const browserHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
    };

    const tryFetch = async (target: string, headers: Record<string, string>) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        return await fetch(target, { headers, signal: controller.signal, redirect: 'follow' });
      } finally {
        clearTimeout(timeout);
      }
    };

    let html = '';
    let lastStatus = 0;
    let fetchErrName = '';

    const attempts: Array<{ url: string; headers: Record<string, string> }> = [
      { url: formattedUrl, headers: browserHeaders },
      { url: `https://r.jina.ai/${formattedUrl}`, headers: { ...browserHeaders, 'x-return-format': 'html' } },
      { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(formattedUrl)}`, headers: browserHeaders },
    ];

    for (const attempt of attempts) {
      try {
        const response = await tryFetch(attempt.url, attempt.headers);
        lastStatus = response.status;
        console.log(`[scrape] HTTP ${response.status} via ${new URL(attempt.url).hostname} (${Date.now() - startTime}ms)`);
        if (!response.ok) continue;
        const text = await response.text();
        if (text.length < 500) continue;
        html = text;
        break;
      } catch (fetchErr: any) {
        fetchErrName = fetchErr?.name ?? 'FetchError';
        console.error(`[scrape] Fetch failed (${attempt.url}):`, fetchErr?.message);
      }
    }

    if (!html) {
      const elapsed = Date.now() - startTime;
      if (lastStatus === 403 || lastStatus === 401) {
        return respond(false, {
          error: 'O site bloqueou a leitura externa. Tente preencher manualmente.',
          diagnostics: { domain, error_stage: 'blocked', http_status: lastStatus, processing_time_ms: elapsed },
        });
      }
      if (lastStatus >= 400) {
        return respond(false, {
          error: `O site retornou erro (${lastStatus}). Verifique a URL.`,
          diagnostics: { domain, error_stage: 'http_error', http_status: lastStatus, processing_time_ms: elapsed },
        });
      }
      return respond(false, {
        error: fetchErrName === 'AbortError'
          ? 'O site demorou muito para responder. Tente novamente mais tarde.'
          : 'Não foi possível acessar o site. Verifique a URL e tente novamente.',
        diagnostics: { domain, error_stage: fetchErrName === 'AbortError' ? 'timeout' : 'fetch_error', processing_time_ms: elapsed },
      });
    }

    console.log(`[scrape] HTML length: ${html.length} chars`);


    // --- Extraction helpers ---
    const getMeta = (property: string): string => {
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i'));
      if (ogMatch) return ogMatch[1];
      const nameMatch = html.match(new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`, 'i'));
      if (nameMatch) return nameMatch[1];
      return '';
    };

    const title = getMeta('og:title') || getMeta('twitter:title')
      || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();
    const description = getMeta('og:description') || getMeta('description') || getMeta('twitter:description');
    const image = getMeta('og:image') || getMeta('twitter:image');

    // --- Price extraction ---
    let price = '';
    const sellPriceMatch = html.match(/data-sell-price=["']([^"']+)["']/i);
    if (sellPriceMatch) price = sellPriceMatch[1];

    if (!price) {
      const promoMatch = html.match(/class=["'][^"']*preco-promocional[^"']*["'][^>]*>[\s\S]*?R\$\s*([\d.,]+)/i);
      if (promoMatch) price = promoMatch[1].replace(/\./g, '').replace(',', '.');
    }
    if (!price) price = getMeta('product:price:amount');

    if (!price) {
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatch) {
        for (const match of jsonLdMatch) {
          const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          try {
            const json = JSON.parse(jsonStr);
            const offers = json.offers || json['@graph']?.find((g: any) => g.offers)?.offers;
            if (offers) price = String(offers.price || offers[0]?.price || '');
          } catch { /* ignore */ }
        }
      }
    }

    if (!price) {
      const fullPriceMatches = html.match(/(?<!de\s)R\$\s*([\d.,]+)/g);
      if (fullPriceMatches) {
        let maxPrice = 0;
        for (const m of fullPriceMatches) {
          const val = m.replace(/R\$\s*/, '').replace(/\./g, '').replace(',', '.');
          const num = parseFloat(val);
          if (num > maxPrice) maxPrice = num;
        }
        if (maxPrice > 0) price = String(maxPrice);
      }
    }

    // --- SKU extraction ---
    let sku = '';
    const skuMicrodataMatch = html.match(/itemprop=["']sku["'][^>]*>([^<]+)</i);
    if (skuMicrodataMatch) sku = skuMicrodataMatch[1].trim();
    if (!sku) { const m = html.match(/SKU-([A-Za-z0-9]+)/); if (m) sku = m[1]; }
    if (!sku) sku = getMeta('product:sku');
    if (!sku) { const m = html.match(/C[óo]digo:\s*<\/b>\s*<span[^>]*>([^<]+)</i); if (m) sku = m[1].trim(); }

    if (!sku) {
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatch) {
        for (const match of jsonLdMatch) {
          const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          try {
            const json = JSON.parse(jsonStr);
            sku = json.sku || json['@graph']?.find((g: any) => g.sku)?.sku || '';
          } catch { /* ignore */ }
        }
      }
    }

    // --- Brand extraction ---
    let brand = '';
    const brandMicrodataMatch = html.match(/itemprop=["']brand["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)</i);
    if (brandMicrodataMatch) brand = brandMicrodataMatch[1].trim();
    if (!brand) { const m = html.match(/itemprop=["']brand["'][\s\S]*?itemprop=["']name["'][^>]*>([^<]+)</i); if (m) brand = m[1].trim(); }
    if (!brand) { const m = html.match(/Marca:\s*<\/b>\s*(?:<[^>]*>)*\s*([^<]+)/i); if (m) brand = m[1].trim(); }
    if (!brand) brand = getMeta('product:brand') || getMeta('og:brand');

    if (!brand) {
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatch) {
        for (const match of jsonLdMatch) {
          const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          try {
            const json = JSON.parse(jsonStr);
            const b = json.brand?.name || json.brand || json['@graph']?.find((g: any) => g.brand)?.brand?.name;
            if (b && typeof b === 'string') brand = b;
          } catch { /* ignore */ }
        }
      }
    }

    const result = {
      name: title,
      description,
      image_url: image,
      price: price ? parseFloat(price) || 0 : 0,
      brand: brand || '',
      sku: sku || '',
    };

    const fieldsFound = [result.name, result.description, result.image_url, result.brand, result.sku]
      .filter(Boolean).length + (result.price > 0 ? 1 : 0);

    console.log(`[scrape] Extracted ${fieldsFound}/6 fields in ${Date.now() - startTime}ms`);

    if (fieldsFound === 0) {
      return respond(false, {
        error: 'Não foi possível extrair dados do produto. O site pode ter estrutura incompatível.',
        diagnostics: { domain, error_stage: 'parse_failed', html_length: html.length, processing_time_ms: Date.now() - startTime },
      });
    }

    return respond(true, {
      success: true,
      data: result,
      diagnostics: { domain, fields_found: fieldsFound, processing_time_ms: Date.now() - startTime },
    });
  } catch (error: any) {
    console.error('[scrape] Unexpected error:', error);
    return respond(false, {
      error: 'Erro interno ao processar importação. Tente novamente.',
      diagnostics: { error_stage: 'internal_error', processing_time_ms: Date.now() - startTime },
    });
  }
});
