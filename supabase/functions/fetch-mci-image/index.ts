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

    // Strategy: split HTML by listagem-item divs, then extract from each
    const parts = html.split(/class="listagem-item/);
    console.log(`Found ${parts.length - 1} listagem-item sections`);

    if (parts.length <= 1) return null;

    for (let i = 1; i < parts.length; i++) {
      const section = parts[i].substring(0, 3000); // Limit section size

      // Extract name
      const nameMatch = section.match(/class="[^"]*nome-produto[^"]*"[^>]*>([^<]+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();

      // Extract image - try src first, then data-imagem-caminho, then any cdn.awsli image
      let imgUrl = '';
      const srcMatch = section.match(/imagem-principal[^>]*\ssrc="(https:\/\/cdn\.awsli[^"]+)"/);
      const dataMatch = section.match(/data-imagem-caminho="(https:\/\/cdn\.awsli[^"]+)"/);
      const anySrc = section.match(/src="(https:\/\/cdn\.awsli\.com\.br\/\d+x\d+\/[^"]+)"/);
      
      imgUrl = srcMatch?.[1] || dataMatch?.[1] || anySrc?.[1] || '';

      if (!imgUrl) continue;

      // Upgrade to higher res
      imgUrl = imgUrl.replace(/\/\d+x\d+\//, '/600x600/');
      
      console.log(`Match found: "${name}" -> ${imgUrl}`);
      return { imageUrl: imgUrl, matchedName: name };
    }

    return null;
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

    const batch = products.slice(0, 10);
    const results: { id: string; image_url: string | null; matched_name: string }[] = [];

    for (const product of batch) {
      let result: { imageUrl: string; matchedName: string } | null = null;

      // 1. Try by code
      if (product.code && product.code !== '-' && product.code.length > 1) {
        result = await searchMCI(product.code);
      }

      // 2. Try by product name (first 5-6 meaningful words)
      if (!result) {
        const cleanName = product.name
          .replace(/\([^)]*\)/g, '')
          .trim()
          .split(/\s+/)
          .slice(0, 5)
          .join(' ');
        result = await searchMCI(cleanName);
      }

      // 3. Try brand + short name
      if (!result && product.brand) {
        const shortName = product.name.split(/\s+/).slice(0, 3).join(' ');
        result = await searchMCI(`${product.brand} ${shortName}`);
      }

      results.push({
        id: product.id,
        image_url: result?.imageUrl || null,
        matched_name: result?.matchedName || '',
      });

      // Small delay
      if (batch.indexOf(product) < batch.length - 1) {
        await new Promise(r => setTimeout(r, 300));
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
