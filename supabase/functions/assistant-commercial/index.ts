import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
const OPENAI_TITLE_MODEL = Deno.env.get('OPENAI_TITLE_MODEL') ?? OPENAI_MODEL;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

// ---------- Tool registry (prepared for future agents) ----------
// Each tool: { schema (OpenAI), handler (executes against DB) }
type ToolCtx = { supabase: any; userId: string; companyId: string | null; context?: any };

const toolRegistry: Record<
  string,
  { schema: any; handler: (args: any, ctx: ToolCtx) => Promise<any> }
> = {
  get_clients: {
    schema: {
      type: 'function',
      function: {
        name: 'get_clients',
        description: 'Buscar clientes do CRM (nome, empresa, cidade, estado, dias sem comprar).',
        parameters: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            days_inactive: { type: 'number' },
            limit: { type: 'number', default: 50 },
          },
        },
      },
    },
    handler: async (args, { supabase }) => {
      const limit = Math.min(args?.limit || 50, 200);
      let q = supabase
        .from('clients')
        .select('id, name, company_name, email, phone, city, state, salesperson_id, created_at, last_purchase_date')
        .limit(limit);
      if (args?.search)
        q = q.or(`name.ilike.%${args.search}%,company_name.ilike.%${args.search}%,email.ilike.%${args.search}%`);
      if (args?.city) q = q.ilike('city', `%${args.city}%`);
      if (args?.state) q = q.ilike('state', `%${args.state}%`);
      if (args?.days_inactive) {
        const cutoff = new Date(Date.now() - args.days_inactive * 86400000).toISOString();
        q = q.or(`last_purchase_date.lt.${cutoff},last_purchase_date.is.null`);
      }
      const { data, error } = await q.order('company_name', { ascending: true });
      if (error) throw error;
      return {
        entity: 'clients',
        columns: ['company_name', 'name', 'city', 'state', 'email', 'phone'],
        rows: data,
        count: data?.length || 0,
      };
    },
  },

  get_quotes: {
    schema: {
      type: 'function',
      function: {
        name: 'get_quotes',
        description: 'Buscar orçamentos/propostas (status, valor mínimo, cliente, últimos X dias).',
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            min_amount: { type: 'number' },
            client_name: { type: 'string' },
            days_back: { type: 'number' },
            limit: { type: 'number', default: 50 },
          },
        },
      },
    },
    handler: async (args, { supabase }) => {
      const limit = Math.min(args?.limit || 50, 200);
      let q = supabase
        .from('quotes')
        .select('id, quote_number, client_name, total_amount, total, status, created_at, created_by, payment_method, payment_status')
        .limit(limit);
      if (args?.status) q = q.eq('status', args.status);
      if (args?.min_amount) q = q.gte('total_amount', args.min_amount);
      if (args?.client_name) q = q.ilike('client_name', `%${args.client_name}%`);
      if (args?.days_back) {
        const cutoff = new Date(Date.now() - args.days_back * 86400000).toISOString();
        q = q.gte('created_at', cutoff);
      }
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return {
        entity: 'quotes',
        columns: ['quote_number', 'client_name', 'total_amount', 'status', 'created_at'],
        rows: data,
        count: data?.length || 0,
      };
    },
  },

  get_metrics: {
    schema: {
      type: 'function',
      function: {
        name: 'get_metrics',
        description: 'Métricas do período: total, aprovados, receita, conversão, ranking por vendedor.',
        parameters: {
          type: 'object',
          properties: { days_back: { type: 'number', default: 30 } },
        },
      },
    },
    handler: async (args, { supabase }) => {
      const days = args?.days_back || 30;
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      const { data: quotes, error } = await supabase
        .from('quotes')
        .select('id, total_amount, total, status, created_by')
        .gte('created_at', cutoff);
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
        summary: {
          period_days: days,
          total_quotes: total,
          approved: approved.length,
          revenue,
          conversion_pct: Math.round(conversion * 10) / 10,
        },
        by_seller: bySeller,
      };
    },
  },

  get_followups: {
    schema: {
      type: 'function',
      function: {
        name: 'get_followups',
        description: 'Follow-ups (tasks) atrasados ou pendentes.',
        parameters: {
          type: 'object',
          properties: { overdue_only: { type: 'boolean', default: true } },
        },
      },
    },
    handler: async (args, { supabase }) => {
      const now = new Date().toISOString();
      let q = supabase.from('tasks').select('id, title, due_date, status, assigned_to, client_id').limit(200);
      if (args?.overdue_only !== false) q = q.lt('due_date', now).neq('status', 'done');
      const { data, error } = await q.order('due_date', { ascending: true });
      if (error) return { entity: 'followups', columns: ['title', 'due_date', 'status'], rows: [], count: 0, note: error.message };
      return { entity: 'followups', columns: ['title', 'due_date', 'status'], rows: data, count: data?.length || 0 };
    },
  },

  get_products: {
    schema: {
      type: 'function',
      function: {
        name: 'get_products',
        description: 'Buscar produtos por nome, marca ou categoria.',
        parameters: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            brand: { type: 'string' },
            category: { type: 'string' },
            limit: { type: 'number', default: 50 },
          },
        },
      },
    },
    handler: async (args, { supabase }) => {
      const limit = Math.min(args?.limit || 50, 200);
      let q = supabase.from('products').select('id, name, code, sku, brand, category_principal, price, level').limit(limit);
      if (args?.search) q = q.or(`name.ilike.%${args.search}%,code.ilike.%${args.search}%,sku.ilike.%${args.search}%`);
      if (args?.brand) q = q.ilike('brand', `%${args.brand}%`);
      if (args?.category) q = q.ilike('category_principal', `%${args.category}%`);
      const { data, error } = await q.order('name');
      if (error) throw error;
      return {
        entity: 'products',
        columns: ['name', 'code', 'brand', 'category_principal', 'price'],
        rows: data,
        count: data?.length || 0,
      };
    },
  },
};

// Placeholder tools for future agent capabilities (declared but not yet handled)
const futureTools = [
  { name: 'get_pipeline', description: 'Visão do pipeline (etapas, valores por estágio).' },
  { name: 'get_demonstrations', description: 'Demonstrações ativas e vencidas.' },
  { name: 'create_followup', description: 'Criar follow-up para um cliente.' },
  { name: 'create_task', description: 'Criar tarefa no TaskHub.' },
  { name: 'create_quote', description: 'Criar novo orçamento.' },
  { name: 'create_contract', description: 'Gerar contrato a partir de template.' },
  { name: 'send_to_taskhub', description: 'Enviar item para o TaskHub.' },
];

const openaiTools = Object.values(toolRegistry).map((t) => t.schema);

async function generateTitle(userText: string): Promise<string> {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_TITLE_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Gere um título curto (máx 5 palavras, português, sem aspas, sem emojis, capitalize a primeira letra) para a pergunta comercial abaixo. Exemplos: "Clientes Canon", "Propostas Junho", "Cross Sell Aputure".',
          },
          { role: 'user', content: userText.slice(0, 500) },
        ],
        max_tokens: 20,
      }),
    });
    if (!r.ok) return userText.slice(0, 60);
    const j = await r.json();
    const t = (j.choices?.[0]?.message?.content || '').trim().replace(/^["'\.]+|["'\.]+$/g, '');
    return t || userText.slice(0, 60);
  } catch {
    return userText.slice(0, 60);
  }
}

// ---------- Hybrid mode: rule-based classifier ----------
// Decide se a pergunta pode ser respondida direto via SQL (rápido, grátis)
// ou precisa de GPT (análise, resumo, estratégia, texto).
type Classification =
  | { mode: 'sql'; tool: string; args: any; label: string }
  | { mode: 'gpt'; reason: string };

const GPT_KEYWORDS = [
  'analise', 'análise', 'analisar', 'analisa', 'analytics',
  'resumo', 'resuma', 'resumir', 'sumarize',
  'estratégia', 'estrategia', 'plano de ação', 'plano',
  'previsão', 'previsao', 'forecast', 'projete', 'projeção', 'projecao',
  'sugira', 'sugestão', 'sugestao', 'recomende', 'recomendação', 'recomendacao',
  'cross sell', 'cross-sell', 'upsell', 'up sell', 'up-sell',
  'como aumentar', 'como melhorar', 'oportunidade', 'oportunidades',
  'compare', 'comparação', 'comparacao', 'comparar',
  'escreva', 'escrever', 'redija', 'redigir', 'e-mail', 'email',
  'mensagem', 'whatsapp', 'proposta comercial',
  'por que', 'porque', 'motivo', 'explique', 'interprete',
  'devo visitar', 'devo ligar', 'devo priorizar',
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s%$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classify(raw: string): Classification {
  const q = normalize(raw);
  // 1. GPT triggers first (interpretation words)
  for (const kw of GPT_KEYWORDS) {
    if (q.includes(normalize(kw))) return { mode: 'gpt', reason: `keyword:${kw}` };
  }
  // 2. Structured intents → SQL fast path
  // Extract "ultimos N dias"
  const daysBack = (() => {
    const m = q.match(/ultim[oa]s?\s+(\d{1,3})\s+dias?/) || q.match(/(\d{1,3})\s+dias?/);
    return m ? Math.min(parseInt(m[1], 10), 365) : undefined;
  })();
  const daysInactive = (() => {
    const m = q.match(/(?:sem\s+comprar|inativ[oa]s?|sem\s+compra).*?(\d{1,3})/) || q.match(/(\d{1,3})\s+dias?\s+sem/);
    return m ? Math.min(parseInt(m[1], 10), 3650) : undefined;
  })();
  const minAmount = (() => {
    const m = q.match(/(?:acima|maior|>=?)\s*(?:de\s*)?r?\$?\s*([\d\.]+)\s*(mil|k|milhoes|milhao|milhões|milhão)?/);
    if (!m) return undefined;
    let v = parseFloat(m[1].replace(/\./g, ''));
    if (/mil|k/.test(m[2] || '')) v *= 1000;
    if (/milh/.test(m[2] || '')) v *= 1_000_000;
    return v;
  })();

  // Clients queries
  if (/\bclientes?\b/.test(q)) {
    if (/inativ|sem\s+comprar|nao\s+compr|sem\s+compra/.test(q)) {
      return { mode: 'sql', tool: 'get_clients', args: { days_inactive: daysInactive ?? 180, limit: 200 }, label: 'Clientes sem compra recente' };
    }
    const stateMatch = q.match(/\b(sp|rj|mg|rs|pr|sc|ba|df|go|es|pe|ce|pa|am|mt|ms|to|ro|ac|ap|al|rn|se|pb|pi|ma|rr)\b/);
    const cityMatch = q.match(/(?:em|de|cidade\s+de)\s+([a-z]{3,}(?:\s+[a-z]{3,})?)/);
    const args: any = { limit: 200 };
    if (stateMatch) args.state = stateMatch[1].toUpperCase();
    if (cityMatch) args.city = cityMatch[1];
    // brand-name search
    const brandInName = q.match(/\bclientes?\s+(?:da\s+|de\s+)?([a-z0-9]{3,})/);
    if (brandInName && !stateMatch && !cityMatch && !['sem','com','que','sao','com'].includes(brandInName[1])) {
      args.search = brandInName[1];
    }
    return { mode: 'sql', tool: 'get_clients', args, label: 'Clientes' };
  }

  // Quotes / propostas / orçamentos
  if (/\borcament|\bpropost|\bquote/.test(q)) {
    const args: any = { limit: 200 };
    if (/aprovad/.test(q)) args.status = 'approved';
    else if (/rejeit|recusad/.test(q)) args.status = 'rejected';
    else if (/negocia/.test(q)) args.status = 'negotiation';
    else if (/enviad/.test(q)) args.status = 'sent';
    if (daysBack) args.days_back = daysBack;
    else if (/hoje/.test(q)) args.days_back = 1;
    else if (/semana/.test(q)) args.days_back = 7;
    else if (/m[eê]s/.test(q)) args.days_back = 30;
    if (minAmount) args.min_amount = minAmount;
    return { mode: 'sql', tool: 'get_quotes', args, label: 'Orçamentos' };
  }

  // Products
  if (/\bprodutos?\b/.test(q)) {
    const args: any = { limit: 200 };
    const brand = q.match(/\bmarca\s+([a-z0-9]{3,})/) || q.match(/\bda\s+([a-z0-9]{3,})/);
    if (brand) args.brand = brand[1];
    return { mode: 'sql', tool: 'get_products', args, label: 'Produtos' };
  }

  // Follow-ups / tarefas
  if (/follow[- ]?up|tarefa|atrasad/.test(q)) {
    return { mode: 'sql', tool: 'get_followups', args: { overdue_only: !/todos|todas|pendente/.test(q) }, label: 'Follow-ups' };
  }

  // Metrics / conversão / receita / ranking
  if (/metric|convers|receita|ranking|meta|ticket|desempenh|faturament|vendas?\s+(do|deste|no)/.test(q)) {
    return { mode: 'sql', tool: 'get_metrics', args: { days_back: daysBack ?? 30 }, label: 'Métricas' };
  }

  return { mode: 'gpt', reason: 'no_rule_matched' };
}

// ---------- In-memory cache (per warm instance) ----------
type CacheEntry = { at: number; payload: any };
const sqlCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
function cacheKey(userId: string, tool: string, args: any) {
  return `${userId}:${tool}:${JSON.stringify(args)}`;
}

function humanizeSqlResult(label: string, tool: string, result: any): string {
  if (tool === 'get_metrics' && result?.summary) {
    const s = result.summary;
    const revenue = Number(s.revenue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return `Métricas dos últimos ${s.period_days} dias: ${s.total_quotes} orçamentos, ${s.approved} aprovados (${s.conversion_pct}% de conversão), receita ${revenue}.`;
  }
  const n = result?.count ?? 0;
  const entity = result?.entity || 'registros';
  const map: Record<string, string> = { clients: 'clientes', quotes: 'orçamentos', products: 'produtos', followups: 'follow-ups' };
  const noun = map[entity] || 'registros';
  if (n === 0) return `Nenhum ${noun.replace(/s$/, '')} encontrado para esta consulta.`;
  return `${label}: ${n} ${noun} encontrados.`;
}

function openAiError(aiRes: Response, errText: string) {
  let parsed: any = null;
  try { parsed = JSON.parse(errText); } catch {}
  const type = parsed?.error?.type;
  const code = parsed?.error?.code;
  const isQuota = type === 'insufficient_quota' || code === 'insufficient_quota';
  const isAuth = aiRes.status === 401;
  const friendly = isQuota
    ? 'A chave da OpenAI está sem créditos. Recarregue em platform.openai.com/account/billing e tente novamente.'
    : isAuth
    ? 'A chave da OpenAI é inválida ou foi revogada. Atualize o secret OPENAI_API_KEY.'
    : 'Não foi possível consultar o modelo agora. Tente novamente em instantes.';
  return {
    friendly,
    error_code: isQuota ? 'OPENAI_QUOTA_EXCEEDED' : isAuth ? 'OPENAI_AUTH' : 'OPENAI_ERROR',
    detail: parsed?.error?.message || errText,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const started = Date.now();

  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { message, conversation_id, context } = body as {
      message: string;
      conversation_id?: string | null;
      context?: any;
    };
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load profile (for context + company)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role, company_id, permissions')
      .eq('user_id', userId)
      .maybeSingle();
    const companyId = profile?.company_id ?? null;

    // Ensure conversation
    let convId = conversation_id || null;
    let isNew = false;
    if (!convId) {
      const { data: created, error: cErr } = await supabase
        .from('assistant_conversations')
        .insert({
          user_id: userId,
          company_id: companyId,
          title: message.slice(0, 60),
          question: message.slice(0, 500),
        })
        .select('id')
        .single();
      if (cErr) throw cErr;
      convId = created.id;
      isNew = true;
    }

    // Load prior messages
    const { data: prior } = await supabase
      .from('assistant_messages')
      .select('role, content, tool_name, tool_args, tool_result')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(40);

    // Persist the new user message immediately
    await supabase.from('assistant_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    const contextBlock = `Contexto do usuário (sempre disponível, use quando fizer sentido):
- Empresa (company_id): ${companyId ?? 'n/d'}
- Usuário: ${profile?.full_name ?? userId}
- Perfil: ${profile?.role ?? 'n/d'}
- Módulo atual: ${context?.module ?? 'n/d'}
- Cliente aberto: ${context?.client ? JSON.stringify(context.client) : 'nenhum'}
- Orçamento aberto: ${context?.quote ? JSON.stringify(context.quote) : 'nenhum'}
- Produto aberto: ${context?.product ? JSON.stringify(context.product) : 'nenhum'}
Nunca peça informações que já constem acima.`;

    const systemPrompt = `Você é o Assistente Comercial do CRM MCI — um consultor executivo integrado ao sistema.
Regras:
- Consulte SEMPRE as ferramentas para dados reais (clientes, orçamentos, produtos, métricas, follow-ups). Nunca invente.
- Responda em português, executivo, objetivo, sem emojis, sem tom de chatbot.
- Se a ferramenta voltar vazio, diga claramente.
- Mantenha o contexto da conversa em curso; interprete pedidos como refinamentos da consulta anterior quando aplicável.
- Data atual: ${new Date().toISOString().slice(0, 10)}.

${contextBlock}`;

    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    for (const m of prior || []) {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role, content: m.content || '' });
      }
    }
    messages.push({ role: 'user', content: message });

    let toolUsed: string | null = null;
    let toolResult: any = null;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    for (let step = 0; step < 4; step++) {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: OPENAI_MODEL, messages, tools: openaiTools, tool_choice: 'auto' }),
      });
      if (!aiRes.ok) {
        const errText = await aiRes.text();
        const err = openAiError(aiRes, errText);
        await supabase.from('assistant_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: err.friendly,
          model: OPENAI_MODEL,
          error: err.detail,
          execution_time_ms: Date.now() - started,
        });
        return new Response(
          JSON.stringify({
            conversation_id: convId,
            answer: err.friendly,
            tool_used: null,
            result: null,
            error_code: err.error_code,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const aiJson = await aiRes.json();
      const msg = aiJson.choices?.[0]?.message;
      if (aiJson.usage) {
        promptTokens += aiJson.usage.prompt_tokens || 0;
        completionTokens += aiJson.usage.completion_tokens || 0;
        totalTokens += aiJson.usage.total_tokens || 0;
      }
      if (!msg) break;
      messages.push(msg);

      if (msg.tool_calls?.length) {
        for (const call of msg.tool_calls) {
          const name = call.function.name;
          const args = JSON.parse(call.function.arguments || '{}');
          const tool = toolRegistry[name];
          let result: any;
          try {
            if (!tool) throw new Error(`Ferramenta ${name} ainda não implementada.`);
            result = await tool.handler(args, { supabase, userId, companyId, context });
            toolUsed = name;
            toolResult = result;
          } catch (e: any) {
            result = { error: e.message };
          }
          await supabase.from('assistant_messages').insert({
            conversation_id: convId,
            role: 'tool',
            tool_name: name,
            tool_args: args,
            tool_result: result,
          });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 12000),
          });
        }
        continue;
      }

      // Final assistant answer
      const answer = msg.content || '';
      const elapsed = Date.now() - started;
      await supabase.from('assistant_messages').insert({
        conversation_id: convId,
        role: 'assistant',
        content: answer,
        model: OPENAI_MODEL,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        execution_time_ms: elapsed,
        tool_name: toolUsed,
        tool_result: toolResult,
      });
      await supabase
        .from('assistant_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId);

      // Auto-title on first turn
      if (isNew) {
        const title = await generateTitle(message);
        await supabase.from('assistant_conversations').update({ title }).eq('id', convId);
      }

      return new Response(
        JSON.stringify({
          conversation_id: convId,
          answer,
          tool_used: toolUsed,
          result: toolResult,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        conversation_id: convId,
        answer: 'Não foi possível concluir a análise.',
        tool_used: toolUsed,
        result: toolResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
