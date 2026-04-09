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

  const token = authHeader.replace('Bearer ', '');
  const { data: claims, error } = await supabase.auth.getClaims(token);
  if (error || !claims?.claims) {
    throw new Error('Unauthorized');
  }

  // Check admin role
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) {
    throw new Error('Forbidden: admin only');
  }

  return { supabase, userId: claims.claims.sub as string };
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

  // Update last_sync_at
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
  action: z.enum(['test', 'save', 'sync', 'status']),
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

      // Test first
      await testConnection(api_key, application_key);

      // Upsert credentials
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
      // Get saved credentials
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
