const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductQuery {
  id: string;
  name: string;
  code?: string;
  sku?: string;
  brand?: string;
}

async function searchMCI(query: string): Promise<{ imageUrl: string; matchedName: string } | null> {
  try {
    const url = `https://www.mci.tv/buscar?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) return null;
    const html = await response.text();

    console.log(`Search query: "${query}", HTML length: ${html.length}`);

    // Extract all products from search results
    const products: { name: string; image: string; sku: string }[] = [];

    // More flexible regexes
    const nameRegex = /class="nome-produto"[^>]*>([^<]+)</gi;
    const imgRegex = /class="imagem-principal"[^>]*\ssrc="([^"]+)"/gi;
    const skuRegex = /class="produto-sku[^"]*"[^>]*>([^<]*)</gi;

    const names: string[] = [];
    const images: string[] = [];
    const skus: string[] = [];

    let m;
    while ((m = nameRegex.exec(html)) !== null) names.push(m[1].trim());
    while ((m = imgRegex.exec(html)) !== null) images.push(m[1]);
    while ((m = skuRegex.exec(html)) !== null) skus.push(m[1].trim());

    console.log(`Found: ${names.length} names, ${images.length} images, ${skus.length} skus`);
    if (names.length > 0) console.log(`First product: "${names[0]}"`);

    for (let i = 0; i < names.length && i < images.length; i++) {
      products.push({ name: names[i], image: images[i], sku: skus[i] || '' });
    }

    if (products.length === 0) return null;

    // Return the first (most relevant) result - upgrade image to higher resolution
    const img = products[0].image.replace('/300x300/', '/600x600/');
    return { imageUrl: img, matchedName: products[0].name };
  } catch (error) {
    console.error('Search error for query:', query, error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { products } = await req.json() as { products: ProductQuery[] };

    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ error: 'products array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process max 10 products per request to avoid timeouts
    const batch = products.slice(0, 10);
    const results: { id: string; image_url: string | null; matched_name: string }[] = [];

    for (const product of batch) {
      // Try searching by code first (most specific), then by name keywords
      let result: { imageUrl: string; matchedName: string } | null = null;

      // 1. Try by code if available
      if (product.code && product.code !== '-') {
        result = await searchMCI(product.code);
      }

      // 2. Try by SKU
      if (!result && product.sku) {
        result = await searchMCI(product.sku);
      }

      // 3. Try by product name (use key words - first 5 words)
      if (!result) {
        // Clean up name: remove parentheses content and take key part
        const cleanName = product.name
          .replace(/\([^)]*\)/g, '')
          .replace(/[^\w\sáàãâéèêíìóòõôúùüçÁÀÃÂÉÈÊÍÌÓÒÕÔÚÙÜÇ.-]/g, ' ')
          .trim()
          .split(/\s+/)
          .slice(0, 6)
          .join(' ');
        result = await searchMCI(cleanName);
      }

      // 4. Try with brand + partial name
      if (!result && product.brand) {
        const shortName = product.name.split(/\s+/).slice(0, 3).join(' ');
        result = await searchMCI(`${product.brand} ${shortName}`);
      }

      results.push({
        id: product.id,
        image_url: result?.imageUrl || null,
        matched_name: result?.matchedName || '',
      });

      // Small delay between requests to be nice to the server
      if (batch.indexOf(product) < batch.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
