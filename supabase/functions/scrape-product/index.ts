const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;

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

    // Extract Open Graph and meta tags
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

    // === PRICE EXTRACTION (priority order) ===
    let price = '';

    // 1. Try data-sell-price attribute (Loja Integrada / Brazilian e-commerce platforms - this is the FULL price)
    const sellPriceMatch = html.match(/data-sell-price=["']([^"']+)["']/i);
    if (sellPriceMatch) {
      price = sellPriceMatch[1];
    }

    // 2. Try .preco-promocional or .preco-cheio text (Brazilian stores)
    if (!price) {
      const promoMatch = html.match(/class=["'][^"']*preco-promocional[^"']*["'][^>]*>[\s\S]*?R\$\s*([\d.,]+)/i);
      if (promoMatch) {
        price = promoMatch[1].replace(/\./g, '').replace(',', '.');
      }
    }

    // 3. Try product:price:amount meta
    if (!price) {
      price = getMeta('product:price:amount');
    }

    // 4. Try JSON-LD structured data
    if (!price) {
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatch) {
        for (const match of jsonLdMatch) {
          const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          try {
            const json = JSON.parse(jsonStr);
            const offers = json.offers || json['@graph']?.find((g: any) => g.offers)?.offers;
            if (offers) {
              price = String(offers.price || offers[0]?.price || '');
            }
          } catch { /* ignore */ }
        }
      }
    }

    // 5. Fallback: look for full price patterns (avoid installment prices like "6x de R$ xxx")
    if (!price) {
      // Match R$ price NOT preceded by "de " (which indicates installment)
      const fullPriceMatches = html.match(/(?<!de\s)R\$\s*([\d.,]+)/g);
      if (fullPriceMatches) {
        // Pick the largest value as it's likely the full price
        let maxPrice = 0;
        for (const m of fullPriceMatches) {
          const val = m.replace(/R\$\s*/, '').replace(/\./g, '').replace(',', '.');
          const num = parseFloat(val);
          if (num > maxPrice) maxPrice = num;
        }
        if (maxPrice > 0) price = String(maxPrice);
      }
    }

    // === SKU EXTRACTION ===
    let sku = '';

    // 1. Try itemprop="sku" (Schema.org microdata - most reliable)
    const skuMicrodataMatch = html.match(/itemprop=["']sku["'][^>]*>([^<]+)</i);
    if (skuMicrodataMatch) {
      sku = skuMicrodataMatch[1].trim();
    }

    // 2. Try CSS class pattern SKU-XXXXX (Loja Integrada)
    if (!sku) {
      const skuClassMatch = html.match(/SKU-([A-Za-z0-9]+)/);
      if (skuClassMatch) sku = skuClassMatch[1];
    }

    // 3. Try product:sku meta
    if (!sku) {
      sku = getMeta('product:sku');
    }

    // 4. Try "Código:" label pattern
    if (!sku) {
      const codeMatch = html.match(/C[óo]digo:\s*<\/b>\s*<span[^>]*>([^<]+)</i);
      if (codeMatch) sku = codeMatch[1].trim();
    }

    // 5. Try JSON-LD
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

    // === BRAND EXTRACTION ===
    let brand = '';

    // 1. Try itemprop="brand" with nested link text (Loja Integrada pattern)
    const brandMicrodataMatch = html.match(/itemprop=["']brand["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)</i);
    if (brandMicrodataMatch) {
      brand = brandMicrodataMatch[1].trim();
    }

    // 2. Try itemprop="brand" with itemprop="name"
    if (!brand) {
      const brandNameMatch = html.match(/itemprop=["']brand["'][\s\S]*?itemprop=["']name["'][^>]*>([^<]+)</i);
      if (brandNameMatch) brand = brandNameMatch[1].trim();
    }

    // 3. Try "Marca:" label pattern
    if (!brand) {
      const marcaMatch = html.match(/Marca:\s*<\/b>\s*(?:<[^>]*>)*\s*([^<]+)/i);
      if (marcaMatch) brand = marcaMatch[1].trim();
    }

    // 4. Try product:brand meta or og:brand
    if (!brand) {
      brand = getMeta('product:brand') || getMeta('og:brand');
    }

    // 5. Try JSON-LD
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
      description: description,
      image_url: image,
      price: price ? parseFloat(price) || 0 : 0,
      brand: brand || '',
      sku: sku || '',
    };

    console.log('Scraped result:', JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
