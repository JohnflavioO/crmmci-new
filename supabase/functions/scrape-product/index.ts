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
      // Try og: property
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i'));
      if (ogMatch) return ogMatch[1];
      // Try name= attribute
      const nameMatch = html.match(new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`, 'i'));
      if (nameMatch) return nameMatch[1];
      return '';
    };

    const title = getMeta('og:title') || getMeta('twitter:title')
      || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();

    const description = getMeta('og:description') || getMeta('description') || getMeta('twitter:description');

    const image = getMeta('og:image') || getMeta('twitter:image');

    // Try to extract price from product:price:amount or structured data
    let price = getMeta('product:price:amount');
    if (!price) {
      // Try JSON-LD
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
    if (!price) {
      // Try common price patterns in HTML
      const priceMatch = html.match(/R\$\s*([\d.,]+)/);
      if (priceMatch) {
        price = priceMatch[1].replace('.', '').replace(',', '.');
      }
    }

    // Try to extract brand
    let brand = getMeta('product:brand') || getMeta('og:brand');
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

    // Try to extract SKU
    let sku = getMeta('product:sku');
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
