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
  
  // Mapeamento para o CRM interno (draft, sent, approved, rejected)
  if (s.includes('aprovado') || s.includes('pago') || s.includes('separação') || 
      s.includes('enviado') || s.includes('entregue') || s.includes('concluído') || 
      s.includes('pronto') || s.includes('separado')) {
    return 'approved';
  }
  
  if (s.includes('cancelado') || s.includes('devolvido') || s.includes('extornado')) {
    return 'rejected';
  }
  
  if (s.includes('aguardando') || s.includes('pendente') || s.includes('análise')) {
    return 'sent';
  }
  
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
  const cliente = orderData.cliente || {};
  const clienteNome = cliente.nome || '';
  const clienteEmail = cliente.email || '';
  const clienteTelefone = cliente.telefone_principal || cliente.telefone_celular || '';
  const clienteCpfCnpj = cliente.cpf || cliente.cnpj || '';
  
  const valorTotal = parseFloat(orderData.valor_total) || 0;
  const valorFrete = parseFloat(orderData.valor_envio) || 0;
  const valorDesconto = parseFloat(orderData.valor_desconto) || 0;
  const valorSubtotal = parseFloat(orderData.valor_subtotal) || (valorTotal - valorFrete + valorDesconto);
  
  const dataCriacao = orderData.data_criacao;
  
  // Pagamento
  const primeiroPagamento = orderData.pagamentos?.[0] || {};
  const pagamentoNome = primeiroPagamento.forma_pagamento?.nome || '';
  const parcelas = parseInt(primeiroPagamento.numero_parcelas) || 1;
  const pagamentoStatus = primeiroPagamento.situacao?.nome || '';
  
  // Envio
  const primeiroEnvio = orderData.envios?.[0] || {};
  const formaEnvio = primeiroEnvio.forma_envio?.nome || '';
  const prazoEnvio = primeiroEnvio.prazo ? `${primeiroEnvio.prazo} dias` : '';
  const transportadora = primeiroEnvio.transportadora || '';
  
  // Endereço de entrega
  const enderecoEntrega = orderData.endereco_entrega || {};

  const notesParts: string[] = [];
  notesParts.push(`[Importado da Loja Integrada]`);
  if (clienteEmail) notesParts.push(`Email: ${clienteEmail}`);
  if (clienteTelefone) notesParts.push(`Tel: ${clienteTelefone}`);
  if (clienteCpfCnpj) notesParts.push(`CPF/CNPJ: ${clienteCpfCnpj}`);
  if (orderData.numero_pedido_canal) notesParts.push(`Pedido canal: ${orderData.numero_pedido_canal}`);
  if (pagamentoNome) notesParts.push(`Pagamento: ${pagamentoNome} (${parcelas}x) - ${pagamentoStatus}`);
  if (formaEnvio) notesParts.push(`Envio: ${formaEnvio} via ${transportadora}`);
  if (orderData.observacao) notesParts.push(`Obs Pedido: ${orderData.observacao}`);

  const mappedStatus = mapStatus(situacaoNome);

  return {
    quote_number: quoteNumber || `LI-${externalId}`,
    client_name: clienteNome || `Pedido #${externalId}`,
    client_id: clientId,
    salesperson: adminName,
    salesperson_id: userId,
    status: mappedStatus,
    total_amount: valorTotal,
    total: valorSubtotal, // Valor sem frete e descontos? Ou subtotal?
    shipping_cost: valorFrete,
    discount: valorDesconto,
    payment_method: mapPaymentMethod(pagamentoNome),
    payment_status: mappedStatus === 'approved' ? 'liquidado' : (mappedStatus === 'rejected' ? 'cancelado' : 'pendente'),
    payment_terms: pagamentoNome || null,
    installments: parcelas,
    shipping_method: formaEnvio || null,
    shipping_deadline: prazoEnvio || null,
    notes: notesParts.join('\n'),
    source: 'loja_integrada',
    external_order_id: externalId,
    external_status: situacaoNome,
    created_by: userId,
    quote_date: dataCriacao ? new Date(dataCriacao).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    is_reseller: false,
    is_split_payment: false,
    
    // Dados de endereço de entrega
    shipping_recipient: clienteNome,
    shipping_cep: enderecoEntrega.cep || null,
    shipping_address: enderecoEntrega.endereco || null,
    shipping_address_number: enderecoEntrega.numero || null,
    shipping_complement: enderecoEntrega.complemento || null,
    shipping_neighborhood: enderecoEntrega.bairro || null,
    shipping_city: enderecoEntrega.cidade || null,
    shipping_state: enderecoEntrega.estado || null,
    shipping_phone: clienteTelefone || null,
    use_alt_shipping_address: !!enderecoEntrega.endereco,
  };
}

async function findOrCreateClient(serviceClient: any, orderData: any, userId: string): Promise<string | null> {
  const cliente = orderData.cliente || {};
  const clienteNome = cliente.nome || '';
  const clienteEmail = cliente.email || '';
  const clienteTelefone = cliente.telefone_principal || cliente.telefone_celular || '';
  const clienteCpfCnpj = cliente.cpf || cliente.cnpj || '';
  const razaoSocial = cliente.razao_social || '';
  const tipo = cliente.tipo || (cliente.cnpj ? 'PJ' : 'PF');

  // Endereço de faturamento (mais comum para dados de cadastro do cliente)
  const endereco = orderData.endereco_faturamento || orderData.endereco_entrega || {};

  if (!clienteEmail && !clienteNome) return null;

  let clientId: string | null = null;

  // Tentar encontrar por email
  if (clienteEmail) {
    const { data: existingClient } = await serviceClient
      .from('clients')
      .select('id')
      .eq('email', clienteEmail)
      .maybeSingle();
    if (existingClient) clientId = existingClient.id;
  }

  // Tentar encontrar por CPF/CNPJ se não encontrou por email
  if (!clientId && clienteCpfCnpj) {
    const { data: existingClient } = await serviceClient
      .from('clients')
      .select('id')
      .eq('cpf_cnpj', clienteCpfCnpj)
      .maybeSingle();
    if (existingClient) clientId = existingClient.id;
  }

  const clientPayload = {
    name: clienteNome,
    email: clienteEmail || null,
    phone: clienteTelefone || null,
    cpf_cnpj: clienteCpfCnpj || null,
    company_name: razaoSocial || null,
    address: endereco.endereco || null,
    address_number: endereco.numero || null,
    complement: endereco.complemento || null,
    neighborhood: endereco.bairro || null,
    city: endereco.cidade || null,
    state: endereco.estado || null,
    cep: endereco.cep || null,
    updated_at: new Date().toISOString(),
    pipeline_stage: 'cliente',
  };

  if (clientId) {
    // Atualizar dados do cliente existente
    await serviceClient
      .from('clients')
      .update(clientPayload)
      .eq('id', clientId);
  } else {
    // Criar novo cliente
    const { data: newClient } = await serviceClient
      .from('clients')
      .insert({
        ...clientPayload,
        created_by: userId,
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
  isFullImport = false
) {
  console.log(`[loja-integrada] Starting ${isFullImport ? 'FULL' : 'INCREMENTAL'} sync...`);

  // Fetch integration config to get last sync markers
  const { data: integration } = await serviceClient
    .from('integrations')
    .select('config, last_sync_at')
    .eq('integration_name', 'loja_integrada')
    .maybeSingle();

  const lastSyncAt = integration?.last_sync_at;
  const config = integration?.config || {};
  const lastOrderDate = config.last_order_date;
  
  // A safety window: we'll check status updates for orders up to 24 hours before the last sync
  const safetyWindow = 24 * 60 * 60 * 1000; // 24 hours in ms
  const stopDate = !isFullImport && lastOrderDate 
    ? new Date(new Date(lastOrderDate).getTime() - safetyWindow)
    : null;

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
  const limit = 20;
  
  // Logic update: Since Loja Integrada API might ignore ordering and return oldest first,
  // we fetch from the end (offset = total_count - limit) and work backwards.
  
  // 1. Get total count first
  const initialResp = await fetch(`${LOJA_INTEGRADA_API}/pedido?limit=1`, {
    headers: {
      'Authorization': `chave_api ${apiKey} aplicacao ${applicationKey}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!initialResp.ok) {
    console.error(`[loja-integrada] Failed to get total count: ${initialResp.status}`);
    return { ok: false, error: 'Falha ao obter total de pedidos da Loja Integrada.' };
  }
  
  const initialData = await initialResp.json();
  const totalCount = initialData.meta?.total_count ?? 0;
  console.log(`[loja-integrada] Total orders found: ${totalCount}`);

  let offset = Math.max(0, totalCount - limit);
  let hasMore = totalCount > 0;
  let newestOrderDateFound: string | null = config.last_order_date || null;
  let newestOrderIdFound: string | null = config.last_order_id || null;

  while (hasMore) {
    console.log(`[loja-integrada] Fetching orders at offset ${offset}...`);

    let response: Response;
    try {
      response = await fetch(
        `${LOJA_INTEGRADA_API}/pedido?limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': `chave_api ${apiKey} aplicacao ${applicationKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (fetchErr) {
      console.error(`[loja-integrada] Network error at offset ${offset}:`, fetchErr);
      errors++;
      break;
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`[loja-integrada] API error at offset ${offset}: ${response.status} ${text.slice(0, 200)}`);
      errors++;
      break;
    }

    const data = await response.json();
    const orders = data.objects || [];
    
    if (orders.length === 0) {
      hasMore = false;
      break;
    }

    // Process orders in this page (from newest to oldest within the page if we could, 
    // but here they are oldest to newest, so we process them all)
    // We reverse them to process newest first if we want to stop early
    const sortedOrders = [...orders].reverse();

    for (const order of sortedOrders) {
      const externalId = String(order.numero);
      const orderDateStr = order.data_criacao;
      const orderDate = new Date(orderDateStr);

      // Stop condition for incremental sync
      if (stopDate && orderDate < stopDate) {
        console.log(`[loja-integrada] Reached order ${externalId} from ${orderDateStr}, which is older than safety window (${stopDate.toISOString()}). Stopping sync.`);
        hasMore = false;
        break;
      }

      // Track the newest order found
      if (!newestOrderDateFound || orderDate > new Date(newestOrderDateFound)) {
        newestOrderDateFound = orderDateStr;
        newestOrderIdFound = externalId;
      }

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
            // Optimization: if we already have this order and we are doing incremental sync,
            // we might be able to stop if we are sure no older orders are missing.
            // But we keep going for now due to the safety window.
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

    if (!hasMore || offset === 0) break;

    // Move to previous page
    offset = Math.max(0, offset - limit);
    
    // Rate limiting: small delay between pages
    await new Promise(r => setTimeout(r, 500));
  }

  // Update integration status and markers
  const newConfig = {
    ...config,
    last_order_id: newestOrderIdFound || config.last_order_id,
    last_order_date: newestOrderDateFound || config.last_order_date,
    last_sync_stats: {
      imported,
      updated,
      skipped,
      errors,
      timestamp: new Date().toISOString()
    }
  };

  await serviceClient
    .from('integrations')
    .update({ 
      last_sync_at: new Date().toISOString(), 
      status: 'connected',
      config: newConfig
    })
    .eq('integration_name', 'loja_integrada');

  console.log(`[loja-integrada] Sync complete: ${imported} imported, ${updated} updated, ${skipped} unchanged, ${errors} errors`);

  return {
    ok: true,
    success: true,
    imported,
    updated,
    skipped,
    errors,
    last_order_id: newestOrderIdFound
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
  full: z.boolean().optional(),
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

    const { action, api_key, application_key, page, full } = parsed.data;

    // === AUTO_SYNC (called by cron, uses service role key from Authorization header) ===
    if (action === 'auto_sync') {
      const authHeader = req.headers.get('Authorization');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      
      const isAuthorized = (authHeader && serviceKey && authHeader.includes(serviceKey)) || 
                           (authHeader && anonKey && authHeader.includes(anonKey));

      if (!isAuthorized) {
        console.warn('[loja-integrada] auto_sync: Unauthorized attempt');
        return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
      }

      const serviceClient = getServiceClient();
      const creds = await fetchStoredCredentials(serviceClient);
      if (!creds) {
        console.log('[loja-integrada] Auto-sync: no credentials configured, skipping.');
        return jsonResponse({ ok: true, message: 'No credentials configured, skipping auto-sync.' });
      }

      // Auto-sync is always incremental (full=false)
      const result = await importAllOrders(serviceClient, creds.createdBy, creds.apiKey, creds.applicationKey, false);
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
        config: data?.config || {},
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

    // === IMPORT (incremental by default, unless full=true) ===
    if (action === 'import') {
      const serviceClient = getServiceClient();
      const creds = await fetchStoredCredentials(serviceClient);
      if (!creds) {
        return jsonResponse({ ok: false, error: 'Integração não configurada. Salve suas credenciais primeiro.' });
      }
      const result = await importAllOrders(serviceClient, userId, creds.apiKey, creds.applicationKey, full || false);
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
