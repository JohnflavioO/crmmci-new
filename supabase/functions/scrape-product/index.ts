import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { url } = await req.json();
    if (!url || typeof url !== 'string' || url.length > 2000) {
      return new Response(JSON.stringify({ error: 'URL is required and must be valid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;

    // Validate URL
    try { new URL(formattedUrl); } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Scraping product URL:', formattedUrl);

    const response = await fetch(formattedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch: ${response.status}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await response.text();

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

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
