import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

// Tool definitions exposed to OpenAI function calling
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_clients',
      description: 'Buscar clientes do CRM. Filtra por nome/empresa, cidade, estado ou dias sem comprar.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Termo para nome, empresa ou email' },
          city: { type: 'string' },
          state: { type: 'string' },
          days_inactive: { type: 'number', description: 'Clientes sem comprar há X dias ou mais' },
          limit: { type: 'number', default: 50 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_quotes',
      description: 'Buscar orçamentos/propostas. Filtra por status, valor mínimo, cliente ou período.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'draft, sent, negotiation, approved, rejected' },
          min_amount: { type: 'number' },
          client_name: { type: 'string' },
          days_back: { type: 'number', description: 'Últimos X dias' },
          limit: { type: 'number', default: 50 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_metrics',
      description: 'Métricas do período: total de orçamentos, aprovados, receita, conversão, ranking de vendedores.',
      parameters: {
        type: 'object',
        properties: {
          days_back: { type: 'number', default: 30 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_followups',
      description: 'Follow-ups atrasados ou pendentes do usuário.',
      parameters: {
        type: 'object',
        properties: {
          overdue_only: { type: 'boolean', default: true },
        },
      },
    },
  },
];

async function executeTool(name: string, args: any, supabase: any) {
  const limit = Math.min(args?.limit || 50, 200);

  if (name === 'get_clients') {
    let q = supabase.from('clients').select('id, name, company_name, email, phone, city, state, salesperson_id, created_at, last_purchase_date').limit(limit);
    if (args?.search) q = q.or(`name.ilike.%${args.search}%,company_name.ilike.%${args.search}%,email.ilike.%${args.search}%`);
    if (args?.city) q = q.ilike('city', `%${args.city}%`);
    if (args?.state) q = q.ilike('state', `%${args.state}%`);
    if (args?.days_inactive) {
      const cutoff = new Date(Date.now() - args.days_inactive * 86400000).toISOString();
      q = q.or(`last_purchase_date.lt.${cutoff},last_purchase_date.is.null`);
    }
    const { data, error } = await q.order('company_name', { ascending: true });
    if (error) throw error;
    return { columns: ['company_name', 'name', 'city', 'state', 'email', 'phone'], rows: data, count: data?.length || 0, entity: 'clients' };
  }

  if (name === 'get_quotes') {
    let q = supabase.from('quotes').select('id, quote_number, client_name, total_amount, total, status, created_at, created_by, payment_method, payment_status').limit(limit);
    if (args?.status) q = q.eq('status', args.status);
    if (args?.min_amount) q = q.gte('total_amount', args.min_amount);
    if (args?.client_name) q = q.ilike('client_name', `%${args.client_name}%`);
    if (args?.days_back) {
      const cutoff = new Date(Date.now() - args.days_back * 86400000).toISOString();
      q = q.gte('created_at', cutoff);
    }
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return { columns: ['quote_number', 'client_name', 'total_amount', 'status', 'created_at'], rows: data, count: data?.length || 0, entity: 'quotes' };
  }

  if (name === 'get_metrics') {
    const days = args?.days_back || 30;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { data: quotes, error } = await supabase.from('quotes').select('id, total_amount, total, status, created_by').gte('created_at', cutoff);
    if (error) throw error;
    const total = quotes?.length || 0;
    const approved = quotes?.filter((q: any) => q.status === 'approved') || [];
    const revenue = approved.reduce((s: number, q: any) => s + Number(q.total_amount || q.total || 0), 0);
    const conversion = total ? (approved.length / total) * 100 : 0;
    const bySeller: Record<string, { count: number; revenue: number }> = {};
    for (const q of quotes || []) {
      const k = q.created_by || 'sem_vendedor';
      bySeller[k] ??= { count: 0, revenue: 0 };
      bySeller[k].count++;
      if (q.status === 'approved') bySeller[k].revenue += Number(q.total_amount || q.total || 0);
    }
    return {
      entity: 'metrics',
      summary: { period_days: days, total_quotes: total, approved: approved.length, revenue, conversion_pct: Math.round(conversion * 10) / 10 },
      by_seller: bySeller,
    };
  }

  if (name === 'get_followups') {
    const now = new Date().toISOString();
    let q = supabase.from('tasks').select('id, title, due_date, status, assigned_to, client_id').limit(limit);
    if (args?.overdue_only !== false) q = q.lt('due_date', now).neq('status', 'done');
    const { data, error } = await q.order('due_date', { ascending: true });
    if (error) return { columns: ['title', 'due_date', 'status'], rows: [], count: 0, entity: 'followups', note: error.message };
    return { columns: ['title', 'due_date', 'status'], rows: data, count: data?.length || 0, entity: 'followups' };
  }

  throw new Error(`Unknown tool: ${name}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { question } = await req.json();
    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ error: 'question is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const systemPrompt = `Você é o Assistente Comercial do CRM MCI, um consultor executivo integrado ao sistema.
Regras:
- Sempre consulte as ferramentas antes de responder perguntas sobre dados (clientes, orçamentos, métricas, follow-ups).
- Responda em português, direto, executivo, sem emojis, sem tom de chatbot.
- Nunca invente dados: se a ferramenta retornar vazio, diga claramente.
- Se a pergunta for analítica, escolha a ferramenta mais adequada e sintetize a resposta.
- Data atual: ${new Date().toISOString().slice(0, 10)}.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    let toolUsed: string | null = null;
    let toolResult: any = null;

    for (let step = 0; step < 3; step++) {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: OPENAI_MODEL, messages, tools, tool_choice: 'auto' }),
      });
      if (!aiRes.ok) {
        const errText = await aiRes.text();
        return new Response(JSON.stringify({ error: 'OpenAI error', detail: errText }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const aiJson = await aiRes.json();
      const msg = aiJson.choices?.[0]?.message;
      if (!msg) break;
      messages.push(msg);

      if (msg.tool_calls?.length) {
        for (const call of msg.tool_calls) {
          const args = JSON.parse(call.function.arguments || '{}');
          try {
            const result = await executeTool(call.function.name, args, supabase);
            toolUsed = call.function.name;
            toolResult = result;
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 12000) });
          } catch (e: any) {
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: e.message }) });
          }
        }
        continue;
      }

      // Final answer
      const answer = msg.content || '';
      await supabase.from('assistant_conversations').insert({
        user_id: userData.user.id,
        question,
        answer,
        tool_used: toolUsed,
        result_json: toolResult,
      });
      return new Response(JSON.stringify({ answer, tool_used: toolUsed, result: toolResult }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ answer: 'Não foi possível concluir a análise.', tool_used: toolUsed, result: toolResult }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
