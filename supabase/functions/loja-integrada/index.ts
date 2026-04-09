import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOJA_INTEGRADA_API = 'https://api.lojaintegrada.com.br/v1';

async function getAuthenticatedAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Unauthorized');
  }

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) {
    throw new Error('Forbidden: admin only');
  }

  return { supabase, userId: user.id };
}

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function testConnection(apiKey: string, applicationKey: string) {
  const response = await fetch(`${LOJA_INTEGRADA_API}/pedido?limit=1`, {
    headers: {
      'Authorization': `chave_api ${apiKey}`,
      'Content-Type': 'application/json',
      'chave_aplicacao': applicationKey,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Loja Integrada API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return { success: true, total_orders: data.meta?.total_count ?? 0 };
}

function mapStatus(situacao: string | undefined): string {
  if (!situacao) return 'draft';
  const s = situacao.toLowerCase();
  if (s.includes('aprovado') || s.includes('completo') || s.includes('pago')) return 'approved';
  if (s.includes('cancelado')) return 'rejected';
  if (s.includes('enviado') || s.includes('entregue')) return 'approved';
  if (s.includes('aguardando') || s.includes('pendente')) return 'sent';
  return 'draft';
}

function mapPaymentMethod(method: string | undefined): string | null {
  if (!method) return null;
  const m = method.toLowerCase();
  if (m.includes('pix')) return 'pix';
  if (m.includes('cart') || m.includes('credito') || m.includes('débito')) return 'cartao';
  if (m.includes('boleto')) return 'boleto';
  return null;
}

async function fetchOrderDetails(apiKey: string, applicationKey: string, orderId: string) {
  try {
    const response = await fetch(`${LOJA_INTEGRADA_API}/pedido/${orderId}`, {
      headers: {
        'Authorization': `chave_api ${apiKey}`,
        'Content-Type': 'application/json',
        'chave_aplicacao': applicationKey,
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function importOrders(
  supabase: any,
  userId: string,
  apiKey: string,
  applicationKey: string,
  page = 1
) {
  const limit = 20;
  const offset = (page - 1) * limit;
  const serviceClient = getServiceClient();

  const response = await fetch(
    `${LOJA_INTEGRADA_API}/pedido?limit=${limit}&offset=${offset}&ordering=-data_criacao`,
    {
      headers: {
        'Authorization': `chave_api ${apiKey}`,
        'Content-Type': 'application/json',
        'chave_aplicacao': applicationKey,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const orders = data.objects || [];
  const totalCount = data.meta?.total_count ?? 0;

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const order of orders) {
    const externalId = String(order.numero);

    // Check if already imported
    const { data: existing } = await serviceClient
      .from('quotes')
      .select('id')
      .eq('external_order_id', externalId)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Fetch detailed order data
    const detail = await fetchOrderDetails(apiKey, applicationKey, externalId);
    const orderData = detail || order;

    const situacaoNome = orderData.situacao?.nome || orderData.situacao || '';
    const clienteNome = orderData.cliente?.nome || '';
    const clienteEmail = orderData.cliente?.email || '';
    const valorTotal = parseFloat(orderData.valor_total) || 0;
    const valorFrete = parseFloat(orderData.valor_envio) || 0;
    const valorDesconto = parseFloat(orderData.valor_desconto) || 0;
    const dataCriacao = orderData.data_criacao;
    const pagamento = orderData.pagamentos?.[0]?.forma_pagamento?.nome || '';

    // Generate quote number
    const { data: quoteNumber } = await serviceClient.rpc('generate_quote_number');

    // Build notes from available info
    const notesParts = [];
    if (clienteEmail) notesParts.push(`Email: ${clienteEmail}`);
    if (orderData.cliente?.telefone_principal) notesParts.push(`Tel: ${orderData.cliente.telefone_principal}`);
    if (orderData.numero_pedido_canal) notesParts.push(`Pedido canal: ${orderData.numero_pedido_canal}`);
    if (orderData.observacao) notesParts.push(`Obs: ${orderData.observacao}`);

    const quoteData = {
      quote_number: quoteNumber || `LI-${externalId}`,
      client_name: clienteNome || `Pedido #${externalId}`,
      salesperson: null,
      salesperson_id: null,
      status: mapStatus(situacaoNome),
      total_amount: valorTotal,
      total: valorTotal - valorFrete,
      shipping_cost: valorFrete,
      discount: valorDesconto,
      payment_method: mapPaymentMethod(pagamento),
      payment_status: mapStatus(situacaoNome) === 'approved' ? 'liquidado' : 'pendente',
      payment_terms: pagamento || null,
      notes: notesParts.length > 0 ? `[Importado da Loja Integrada]\n${notesParts.join('\n')}` : '[Importado da Loja Integrada]',
      source: 'loja_integrada',
      external_order_id: externalId,
      external_status: situacaoNome,
      created_by: userId,
      quote_date: dataCriacao ? new Date(dataCriacao).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      is_reseller: false,
      is_split_payment: false,
    };

    const { data: newQuote, error: insertErr } = await serviceClient
      .from('quotes')
      .insert(quoteData)
      .select('id')
      .single();

    if (insertErr) {
      console.error(`Error importing order ${externalId}:`, insertErr.message);
      errors++;
      continue;
    }

    // Import items if available
    const itens = orderData.itens || [];
    if (itens.length > 0 && newQuote) {
      const quoteItems = itens.map((item: any, idx: number) => ({
        quote_id: newQuote.id,
        item_number: idx + 1,
        model: item.nome || item.produto?.nome || `Item ${idx + 1}`,
        brand: '',
        product_code: item.sku || '',
        quantity: parseInt(item.quantidade) || 1,
        unit_price: parseFloat(item.preco_venda) || 0,
        discount_percent: 0,
        unit_total: parseFloat(item.preco_venda) || 0,
        line_total: (parseFloat(item.preco_venda) || 0) * (parseInt(item.quantidade) || 1),
        specifications: '',
        image_url: '',
        is_gift: false,
      }));

      const { error: itemsErr } = await serviceClient
        .from('quote_items')
        .insert(quoteItems);

      if (itemsErr) {
        console.error(`Error importing items for order ${externalId}:`, itemsErr.message);
      }
    }

    imported++;
  }

  // Update last_sync_at
  await supabase
    .from('integrations')
    .update({ last_sync_at: new Date().toISOString(), status: 'connected' })
    .eq('integration_name', 'loja_integrada');

  return {
    success: true,
    imported,
    skipped,
    errors,
    total_count: totalCount,
    page,
    has_more: offset + limit < totalCount,
  };
}

async function syncOrders(supabase: any, apiKey: string, applicationKey: string, page = 1) {
  const limit = 20;
  const offset = (page - 1) * limit;

  const response = await fetch(
    `${LOJA_INTEGRADA_API}/pedido?limit=${limit}&offset=${offset}&ordering=-data_criacao`,
    {
      headers: {
        'Authorization': `chave_api ${apiKey}`,
        'Content-Type': 'application/json',
        'chave_aplicacao': applicationKey,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const orders = data.objects || [];
  const totalCount = data.meta?.total_count ?? 0;

  await supabase
    .from('integrations')
    .update({ last_sync_at: new Date().toISOString(), status: 'connected' })
    .eq('integration_name', 'loja_integrada');

  return {
    success: true,
    orders: orders.map((o: any) => ({
      id: o.numero,
      status: o.situacao?.nome || o.status,
      client_name: o.cliente?.nome || '',
      client_email: o.cliente?.email || '',
      total: o.valor_total,
      date: o.data_criacao,
    })),
    total_count: totalCount,
    page,
    has_more: offset + limit < totalCount,
  };
}

const ActionSchema = z.object({
  action: z.enum(['test', 'save', 'sync', 'status', 'import']),
  api_key: z.string().optional(),
  application_key: z.string().optional(),
  page: z.number().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await getAuthenticatedAdmin(req);

    const parsed = ActionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, api_key, application_key, page } = parsed.data;

    if (action === 'status') {
      const { data } = await supabase
        .from('integrations')
        .select('status, last_sync_at, config')
        .eq('integration_name', 'loja_integrada')
        .maybeSingle();

      return new Response(JSON.stringify({
        connected: data?.status === 'connected',
        status: data?.status || 'disconnected',
        last_sync_at: data?.last_sync_at,
        has_credentials: !!data,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'test') {
      if (!api_key || !application_key) {
        return new Response(JSON.stringify({ error: 'API Key e Application Key são obrigatórias' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await testConnection(api_key, application_key);
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'save') {
      if (!api_key || !application_key) {
        return new Response(JSON.stringify({ error: 'API Key e Application Key são obrigatórias' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await testConnection(api_key, application_key);

      const { error: upsertErr } = await supabase
        .from('integrations')
        .upsert({
          integration_name: 'loja_integrada',
          api_key,
          application_key,
          status: 'connected',
          created_by: userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'integration_name' });

      if (upsertErr) {
        throw new Error('Failed to save: ' + upsertErr.message);
      }

      return new Response(JSON.stringify({ success: true, message: 'Integração salva com sucesso' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync') {
      const { data: integration } = await supabase
        .from('integrations')
        .select('api_key, application_key')
        .eq('integration_name', 'loja_integrada')
        .maybeSingle();

      if (!integration?.api_key || !integration?.application_key) {
        return new Response(JSON.stringify({ error: 'Integração não configurada' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await syncOrders(supabase, integration.api_key, integration.application_key, page || 1);
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'import') {
      const { data: integration } = await supabase
        .from('integrations')
        .select('api_key, application_key')
        .eq('integration_name', 'loja_integrada')
        .maybeSingle();

      if (!integration?.api_key || !integration?.application_key) {
        return new Response(JSON.stringify({ error: 'Integração não configurada' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await importOrders(supabase, userId, integration.api_key, integration.application_key, page || 1);
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500;
    console.error('loja-integrada error:', error);
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
