import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOJA_INTEGRADA_API = 'https://api.awsli.com.br/v1';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function maskKey(key: string): string {
  if (key.length <= 6) return '***';
  return key.slice(0, 3) + '***' + key.slice(-3);
}

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
  console.log('[loja-integrada] Testing connection...');
  console.log(`[loja-integrada] API Key: ${maskKey(apiKey)}, App Key: ${maskKey(applicationKey)}`);

  const url = `${LOJA_INTEGRADA_API}/pedido?limit=1`;
  console.log(`[loja-integrada] Calling: GET ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Authorization': `chave_api ${apiKey} aplicacao ${applicationKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (fetchErr) {
    console.error('[loja-integrada] Network error:', fetchErr);
    return {
      ok: false,
      error: 'Erro de rede ao conectar com a Loja Integrada. Verifique sua conexão.',
      error_stage: 'network',
    };
  }

  console.log(`[loja-integrada] Response status: ${response.status}`);

  const responseText = await response.text();

  if (!response.ok) {
    console.error(`[loja-integrada] API error body: ${responseText.slice(0, 500)}`);

    if (response.status === 401) {
      return { ok: false, error: 'API Key inválida ou não autorizada pela Loja Integrada.', error_stage: 'authentication', http_status: 401 };
    }
    if (response.status === 403) {
      return { ok: false, error: 'Application Key inválida ou sem permissão.', error_stage: 'authorization', http_status: 403 };
    }
    if (response.status === 404) {
      return { ok: false, error: 'Endpoint da API não encontrado.', error_stage: 'endpoint', http_status: 404 };
    }
    return { ok: false, error: `Erro ${response.status} na API da Loja Integrada: ${responseText.slice(0, 200)}`, error_stage: 'api_call', http_status: response.status };
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    return { ok: false, error: 'Resposta inválida da Loja Integrada (não é JSON).', error_stage: 'parse' };
  }

  console.log(`[loja-integrada] Connection OK. Total orders: ${data.meta?.total_count ?? 0}`);
  return { ok: true, success: true, total_orders: data.meta?.total_count ?? 0 };
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
        'Authorization': `chave_api ${apiKey} aplicacao ${applicationKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      await response.text();
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchStoredCredentials(serviceClient: any) {
  const { data: integration } = await serviceClient
    .from('integrations')
    .select('api_key, application_key, created_by')
    .eq('integration_name', 'loja_integrada')
    .maybeSingle();

  if (!integration?.api_key || !integration?.application_key) {
    return null;
  }
  return { apiKey: integration.api_key, applicationKey: integration.application_key, createdBy: integration.created_by };
}

function buildQuoteData(
  orderData: any,
  externalId: string,
  clientId: string | null,
  userId: string,
  adminName: string,
  quoteNumber: string | null
) {
  const situacaoNome = orderData.situacao?.nome || orderData.situacao || '';
  const clienteNome = orderData.cliente?.nome || '';
  const clienteEmail = orderData.cliente?.email || '';
  const clienteTelefone = orderData.cliente?.telefone_principal || '';
  const clienteCpfCnpj = orderData.cliente?.cpf || orderData.cliente?.cnpj || '';
  const valorTotal = parseFloat(orderData.valor_total) || 0;
  const valorFrete = parseFloat(orderData.valor_envio) || 0;
  const valorDesconto = parseFloat(orderData.valor_desconto) || 0;
  const dataCriacao = orderData.data_criacao;
  const pagamento = orderData.pagamentos?.[0]?.forma_pagamento?.nome || '';

  const notesParts: string[] = [];
  if (clienteEmail) notesParts.push(`Email: ${clienteEmail}`);
  if (clienteTelefone) notesParts.push(`Tel: ${clienteTelefone}`);
  if (clienteCpfCnpj) notesParts.push(`CPF/CNPJ: ${clienteCpfCnpj}`);
  if (orderData.numero_pedido_canal) notesParts.push(`Pedido canal: ${orderData.numero_pedido_canal}`);
  if (orderData.observacao) notesParts.push(`Obs: ${orderData.observacao}`);

  const mappedStatus = mapStatus(situacaoNome);

  return {
    quote_number: quoteNumber || `LI-${externalId}`,
    client_name: clienteNome || `Pedido #${externalId}`,
    client_id: clientId,
    salesperson: adminName,
    salesperson_id: userId,
    status: mappedStatus,
    total_amount: valorTotal,
    total: valorTotal - valorFrete,
    shipping_cost: valorFrete,
    discount: valorDesconto,
    payment_method: mapPaymentMethod(pagamento),
    payment_status: mappedStatus === 'approved' ? 'liquidado' : 'pendente',
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
}

async function findOrCreateClient(serviceClient: any, orderData: any, userId: string): Promise<string | null> {
  const clienteNome = orderData.cliente?.nome || '';
  const clienteEmail = orderData.cliente?.email || '';
  const clienteTelefone = orderData.cliente?.telefone_principal || '';
  const clienteCpfCnpj = orderData.cliente?.cpf || orderData.cliente?.cnpj || '';

  if (!clienteEmail && !clienteNome) return null;

  let clientId: string | null = null;

  if (clienteEmail) {
    const { data: existingClient } = await serviceClient
      .from('clients')
      .select('id')
      .eq('email', clienteEmail)
      .maybeSingle();
    if (existingClient) clientId = existingClient.id;
  }

  if (!clientId && clienteNome) {
    const { data: existingClient } = await serviceClient
      .from('clients')
      .select('id')
      .eq('name', clienteNome)
      .maybeSingle();
    if (existingClient) clientId = existingClient.id;
  }

  if (!clientId && clienteNome) {
    const { data: newClient } = await serviceClient
      .from('clients')
      .insert({
        name: clienteNome,
        email: clienteEmail || null,
        phone: clienteTelefone || null,
        cpf_cnpj: clienteCpfCnpj || null,
        created_by: userId,
        pipeline_stage: 'cliente',
      })
      .select('id')
      .single();
    if (newClient) clientId = newClient.id;
  }

  return clientId;
}

async function upsertQuoteItems(serviceClient: any, quoteId: string, orderData: any) {
  const itens = orderData.itens || [];
  if (itens.length === 0) return;

  // Delete old items and re-insert
  await serviceClient.from('quote_items').delete().eq('quote_id', quoteId);

  const quoteItems = itens.map((item: any, idx: number) => ({
    quote_id: quoteId,
    item_number: idx + 1,
    description: item.nome || item.produto?.nome || `Item ${idx + 1}`,
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

  const { error: itemsErr } = await serviceClient.from('quote_items').insert(quoteItems);
  if (itemsErr) {
    console.error(`[loja-integrada] Error upserting items for quote ${quoteId}:`, itemsErr.message);
  }
}

async function importAllOrders(
  serviceClient: any,
  userId: string,
  apiKey: string,
  applicationKey: string,
) {
  console.log('[loja-integrada] Starting full import/upsert...');

  const { data: adminProfile } = await serviceClient
    .from('profiles')
    .select('full_name')
    .eq('user_id', userId)
    .maybeSingle();
  const adminName = adminProfile?.full_name || 'Admin';

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let page = 1;
  const limit = 50;
  let hasMore = true;

  while (hasMore) {
    const offset = (page - 1) * limit;
    console.log(`[loja-integrada] Fetching page ${page} (offset ${offset})...`);

    let response: Response;
    try {
      response = await fetch(
        `${LOJA_INTEGRADA_API}/pedido?limit=${limit}&offset=${offset}&ordering=-data_criacao`,
        {
          headers: {
            'Authorization': `chave_api ${apiKey} aplicacao ${applicationKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (fetchErr) {
      console.error(`[loja-integrada] Network error on page ${page}:`, fetchErr);
      errors++;
      break;
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`[loja-integrada] API error on page ${page}: ${response.status} ${text.slice(0, 200)}`);
      errors++;
      break;
    }

    const data = await response.json();
    const orders = data.objects || [];
    const totalCount = data.meta?.total_count ?? 0;

    if (orders.length === 0) {
      hasMore = false;
      break;
    }

    for (const order of orders) {
      const externalId = String(order.numero);

      try {
        const detail = await fetchOrderDetails(apiKey, applicationKey, externalId);
        const orderData = detail || order;
        const situacaoNome = orderData.situacao?.nome || orderData.situacao || '';

        // Check if already exists
        const { data: existing } = await serviceClient
          .from('quotes')
          .select('id, external_status, status')
          .eq('external_order_id', externalId)
          .maybeSingle();

        if (existing) {
          // Update if status changed
          const newMappedStatus = mapStatus(situacaoNome);
          if (existing.external_status !== situacaoNome) {
            const updateData: Record<string, unknown> = {
              external_status: situacaoNome,
              updated_at: new Date().toISOString(),
            };
            // Only update CRM status if the order wasn't manually changed
            if (existing.status === mapStatus(existing.external_status)) {
              updateData.status = newMappedStatus;
              updateData.payment_status = newMappedStatus === 'approved' ? 'liquidado' : 'pendente';
            }

            await serviceClient.from('quotes').update(updateData).eq('id', existing.id);
            console.log(`[loja-integrada] Updated order ${externalId}: ${existing.external_status} -> ${situacaoNome}`);
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

        // New order - create
        const clientId = await findOrCreateClient(serviceClient, orderData, userId);
        const { data: quoteNumber } = await serviceClient.rpc('generate_quote_number');

        const quoteData = buildQuoteData(orderData, externalId, clientId, userId, adminName, quoteNumber);

        const { data: newQuote, error: insertErr } = await serviceClient
          .from('quotes')
          .insert(quoteData)
          .select('id')
          .single();

        if (insertErr) {
          console.error(`[loja-integrada] Error importing order ${externalId}:`, insertErr.message);
          errors++;
          continue;
        }

        if (newQuote) {
          await upsertQuoteItems(serviceClient, newQuote.id, orderData);
        }

        console.log(`[loja-integrada] Imported new order ${externalId} as quote ${quoteData.quote_number}`);
        imported++;
      } catch (orderErr) {
        console.error(`[loja-integrada] Error processing order ${externalId}:`, orderErr);
        errors++;
      }
    }

    hasMore = offset + limit < totalCount;
    page++;

    // Rate limiting: small delay between pages
    if (hasMore) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Update integration status
  await serviceClient
    .from('integrations')
    .update({ last_sync_at: new Date().toISOString(), status: 'connected' })
    .eq('integration_name', 'loja_integrada');

  console.log(`[loja-integrada] Import complete: ${imported} imported, ${updated} updated, ${skipped} unchanged, ${errors} errors`);

  return {
    ok: true,
    success: true,
    imported,
    updated,
    skipped,
    errors,
  };
}

async function syncOrders(serviceClient: any, apiKey: string, applicationKey: string, page = 1) {
  const limit = 20;
  const offset = (page - 1) * limit;

  const response = await fetch(
    `${LOJA_INTEGRADA_API}/pedido?limit=${limit}&offset=${offset}&ordering=-data_criacao`,
    {
      headers: {
        'Authorization': `chave_api ${apiKey} aplicacao ${applicationKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`[loja-integrada] Sync fetch error ${response.status}: ${text}`);
    return { ok: false, error: `Erro ${response.status} ao buscar pedidos.`, error_stage: 'fetch_orders' };
  }

  const data = await response.json();
  const orders = data.objects || [];
  const totalCount = data.meta?.total_count ?? 0;

  await serviceClient
    .from('integrations')
    .update({ last_sync_at: new Date().toISOString(), status: 'connected' })
    .eq('integration_name', 'loja_integrada');

  return {
    ok: true,
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
  action: z.enum(['test', 'save', 'sync', 'status', 'import', 'auto_sync']),
  api_key: z.string().optional(),
  application_key: z.string().optional(),
  page: z.number().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ ok: false, error: 'Requisição inválida', details: parsed.error.flatten().fieldErrors }, 400);
    }

    const { action, api_key, application_key, page } = parsed.data;

    // === AUTO_SYNC (called by cron, uses service role key from Authorization header) ===
    if (action === 'auto_sync') {
      const authHeader = req.headers.get('Authorization');
      const expectedKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (!authHeader || !authHeader.includes(expectedKey || '___none___')) {
        return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
      }

      const serviceClient = getServiceClient();
      const creds = await fetchStoredCredentials(serviceClient);
      if (!creds) {
        console.log('[loja-integrada] Auto-sync: no credentials configured, skipping.');
        return jsonResponse({ ok: true, message: 'No credentials configured, skipping auto-sync.' });
      }

      const result = await importAllOrders(serviceClient, creds.createdBy, creds.apiKey, creds.applicationKey);
      return jsonResponse(result);
    }

    // All other actions require authenticated admin
    const { supabase, userId } = await getAuthenticatedAdmin(req);

    // === STATUS ===
    if (action === 'status') {
      const { data } = await supabase
        .from('integrations')
        .select('status, last_sync_at, config')
        .eq('integration_name', 'loja_integrada')
        .maybeSingle();

      return jsonResponse({
        ok: true,
        connected: data?.status === 'connected',
        status: data?.status || 'disconnected',
        last_sync_at: data?.last_sync_at,
        has_credentials: !!data,
      });
    }

    // === TEST ===
    if (action === 'test') {
      if (!api_key || !application_key) {
        return jsonResponse({ ok: false, error: 'API Key e Application Key são obrigatórias' });
      }
      const result = await testConnection(api_key, application_key);
      return jsonResponse(result);
    }

    // === SAVE ===
    if (action === 'save') {
      if (!api_key || !application_key) {
        return jsonResponse({ ok: false, error: 'API Key e Application Key são obrigatórias' });
      }

      const testResult = await testConnection(api_key, application_key);
      if (!testResult.ok) {
        return jsonResponse(testResult);
      }

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
        console.error('[loja-integrada] Upsert error:', upsertErr.message);
        return jsonResponse({ ok: false, error: 'Erro ao salvar credenciais no banco de dados.' });
      }

      return jsonResponse({ ok: true, success: true, message: 'Integração salva com sucesso' });
    }

    // === SYNC (preview only) ===
    if (action === 'sync') {
      const serviceClient = getServiceClient();
      const creds = await fetchStoredCredentials(serviceClient);
      if (!creds) {
        return jsonResponse({ ok: false, error: 'Integração não configurada. Salve suas credenciais primeiro.' });
      }
      const result = await syncOrders(serviceClient, creds.apiKey, creds.applicationKey, page || 1);
      return jsonResponse(result);
    }

    // === IMPORT (full upsert) ===
    if (action === 'import') {
      const serviceClient = getServiceClient();
      const creds = await fetchStoredCredentials(serviceClient);
      if (!creds) {
        return jsonResponse({ ok: false, error: 'Integração não configurada. Salve suas credenciais primeiro.' });
      }
      const result = await importAllOrders(serviceClient, userId, creds.apiKey, creds.applicationKey);
      return jsonResponse(result);
    }

    return jsonResponse({ ok: false, error: 'Ação desconhecida' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('[loja-integrada] Unhandled error:', error);

    if (message === 'Unauthorized') {
      return jsonResponse({ ok: false, error: 'Não autorizado. Faça login novamente.' }, 401);
    }
    if (message.startsWith('Forbidden')) {
      return jsonResponse({ ok: false, error: 'Acesso restrito ao administrador.' }, 403);
    }

    return jsonResponse({ ok: false, error: message });
  }
});
