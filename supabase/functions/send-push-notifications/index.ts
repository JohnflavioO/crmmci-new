import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Interface for the notification
interface PushNotification {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    if (action === "scan_followups") {
      return await handleScanFollowups(supabase);
    } else if (action === "send_push") {
      const { notification } = body;
      return await handleSendPush(supabase, notification);
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro na edge function send-push-notifications:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleScanFollowups(supabase: any) {
  console.log("Iniciando scan de follow-ups...");
  
  const today = new Date().toISOString().split('T')[0];
  
  // 1. Orçamentos com follow-up para hoje ou vencidos
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select(`
      id, 
      quote_number, 
      client_name, 
      salesperson_id, 
      followup_date,
      status
    `)
    .in('status', ['Contato Feito', 'Proposta Enviada', 'Pré-venda', 'Em Negociação', 'Lançamento Rápido'])
    .not('followup_date', 'is', null)
    .lte('followup_date', today);

  if (error) throw error;

  let pushCount = 0;
  for (const quote of quotes) {
    // Verificar se já enviamos push para este orçamento hoje
    const { data: existingLog } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', quote.salesperson_id)
      .eq('related_quote_id', quote.id)
      .eq('type', 'followup_push')
      .gte('created_at', today)
      .maybeSingle();

    if (!existingLog) {
      const isOverdue = new Date(quote.followup_date).toISOString().split('T')[0] < today;
      const title = isOverdue ? "⚠️ Follow-up Vencido" : "📅 Follow-up para Hoje";
      const body = `O orçamento ${quote.quote_number} de ${quote.client_name} precisa de atenção.`;
      
      await sendPushToUser(supabase, {
        userId: quote.salesperson_id,
        title,
        body,
        data: {
          url: `/quotes?id=${quote.id}`,
          quoteId: quote.id
        }
      });
      
      // Log na tabela de notificações internas também
      await supabase.from('notifications').insert({
        user_id: quote.salesperson_id,
        title,
        message: body,
        type: 'followup_push',
        related_quote_id: quote.id,
        is_read: false
      });

      pushCount++;
    }
  }

  return new Response(JSON.stringify({ success: true, pushes_sent: pushCount }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSendPush(supabase: any, notification: PushNotification) {
  const success = await sendPushToUser(supabase, notification);
  return new Response(JSON.stringify({ success }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendPushToUser(supabase: any, notification: PushNotification): Promise<boolean> {
  const { data: tokens, error } = await supabase
    .from('user_push_tokens')
    .select('fcm_token')
    .eq('user_id', notification.userId)
    .eq('is_active', true);

  if (error || !tokens || tokens.length === 0) {
    console.log(`Nenhum token ativo encontrado para o usuário ${notification.userId}`);
    return false;
  }

  const results = await Promise.all(tokens.map((t: any) => sendToFcm(t.fcm_token, notification)));
  return results.some(r => r === true);
}

async function sendToFcm(token: string, notification: PushNotification): Promise<boolean> {
  console.log(`Enviando push para token: ${token.substring(0, 10)}...`);
  console.log(`Título: ${notification.title}`);
  return true; 
}
