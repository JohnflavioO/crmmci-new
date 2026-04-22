
import { createClient } from '@supabase/supabase-js';

const LOJA_INTEGRADA_API = 'https://api.awsli.com.br/v1';
const apiKey = '12ac635b711ce3b105bc';
const applicationKey = 'ecdca8a5-487f-46f0-a61d-27eab2cc98f6';

const supabaseUrl = 'https://npqujpfqsnwxowlciyof.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wcXVqcGZxc253eG93bGNpeW9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk3NTk4OCwiZXhwIjoyMDkwNTUxOTg4fQ.VrOtFebbWVGqoEDadxKfmIO2jCZPiG6yDlZbynYiF3k';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function sync() {
  console.log('Starting local sync...');
  
  // 1. Get total count
  const initialResp = await fetch(`${LOJA_INTEGRADA_API}/pedido?limit=1`, {
    headers: {
      'Authorization': `chave_api ${apiKey} aplicacao ${applicationKey}`,
      'Content-Type': 'application/json',
    },
  });
  
  const initialData = await initialResp.json();
  const totalCount = initialData.meta?.total_count ?? 0;
  console.log(`Total orders: ${totalCount}`);

  const limit = 50;
  let offset = Math.max(0, totalCount - limit);
  let imported = 0;

  console.log(`Fetching from offset ${offset}...`);
  const response = await fetch(
    `${LOJA_INTEGRADA_API}/pedido?limit=${limit}&offset=${offset}`,
    {
      headers: {
        'Authorization': `chave_api ${apiKey} aplicacao ${applicationKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();
  const orders = data.objects || [];
  
  for (const order of orders.reverse()) {
    const externalId = String(order.numero);
    console.log(`Processing order #${externalId}...`);
    
    // Check if exists
    const { data: existing } = await supabase
      .from('quotes')
      .select('id')
      .eq('external_order_id', externalId)
      .maybeSingle();
      
    if (existing) {
      console.log(`Order #${externalId} already exists, skipping.`);
      continue;
    }
    
    // Import (simplified for testing)
    const { data: quoteNumber } = await supabase.rpc('generate_quote_number');
    
    const { data: newQuote, error: insertErr } = await supabase
      .from('quotes')
      .insert({
        quote_number: `LI-${externalId}`,
        client_name: order.cliente?.nome || `Pedido #${externalId}`,
        status: 'draft',
        total_amount: parseFloat(order.valor_total) || 0,
        total: parseFloat(order.valor_total) || 0,
        source: 'loja_integrada',
        external_order_id: externalId,
        external_status: order.situacao?.nome || order.situacao || '',
        created_by: '38e2b046-5c6a-40bf-a6c9-e3dc4709c07a' // Admin ID from integrations table
      })
      .select('id')
      .single();
      
    if (insertErr) {
      console.error(`Error importing #${externalId}:`, insertErr.message);
    } else {
      console.log(`Successfully imported #${externalId} as LI-${externalId}`);
      imported++;
    }
  }
  
  console.log(`Sync complete. Imported ${imported} orders.`);
}

sync();
