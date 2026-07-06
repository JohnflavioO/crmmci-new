import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
const OPENAI_TITLE_MODEL = Deno.env.get('OPENAI_TITLE_MODEL') ?? OPENAI_MODEL;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type ToolCtx = {
  supabase: any;           // JWT-scoped (RLS)
  service: any;            // service_role (audit only)
  userId: string;
  companyId: string | null;
  profile: any;
  context?: any;
  ip?: string;
  userAgent?: string;
  conversationId?: string | null;
};

// ============================================================
// READ TOOLS — executam direto, sem confirmação
// ============================================================
// Escopo por papel: mesmo padrão do CRM.
// - admin/gestor: veem sua carteira (created_by/salesperson_id = userId) POR PADRÃO.
//   Só ampliam para equipe/global se args.scope='team' (gestor/admin) for enviado explicitamente.
// - demais papéis: sempre restritos aos próprios registros.
function scopeOwn(query: any, column: string, userId: string, profile: any, scope?: string) {
  const role = profile?.role;
  const isBoss = role === 'admin' || role === 'gestor';
  if (isBoss && scope === 'team') return query; // consulta ampla (equipe) somente sob demanda
  return query.eq(column, userId);
}

const readTools: Record<string, { schema: any; handler: (args: any, ctx: ToolCtx) => Promise<any> }> = {
  get_clients: {
    schema: { type: 'function', function: { name: 'get_clients', description: 'Buscar clientes da carteira do usuário. Use scope="team" apenas se admin/gestor pedir explicitamente a equipe inteira.', parameters: { type: 'object', properties: { search: { type: 'string' }, city: { type: 'string' }, state: { type: 'string' }, days_inactive: { type: 'number' }, limit: { type: 'number' }, scope: { type: 'string', enum: ['own','team'] } } } } },
    handler: async (args, { supabase, userId, profile }) => {
      const limit = Math.min(args?.limit || 50, 200);
      let q = supabase.from('clients').select('id, name, company_name, email, phone, city, state, salesperson_id, created_by, created_at, last_interaction_at').limit(limit);
      q = scopeOwn(q, 'salesperson_id', userId, profile, args?.scope);
      if (args?.search) q = q.or(`name.ilike.%${args.search}%,company_name.ilike.%${args.search}%,email.ilike.%${args.search}%`);
      if (args?.city) q = q.ilike('city', `%${args.city}%`);
      if (args?.state) q = q.ilike('state', `%${args.state}%`);
      if (args?.days_inactive) {
        const cutoff = new Date(Date.now() - args.days_inactive * 86400000).toISOString();
        q = q.or(`last_interaction_at.lt.${cutoff},last_interaction_at.is.null`);
      }
      const { data, error } = await q.order('company_name');
      if (error) throw error;
      return { entity: 'clients', scope: args?.scope || 'own', columns: ['company_name', 'name', 'city', 'state', 'email', 'phone'], rows: data, count: data?.length || 0 };
    },
  },
  get_quotes: {
    schema: { type: 'function', function: { name: 'get_quotes', description: 'Buscar orçamentos da carteira do usuário. Suporta ordenação (created_at, total_amount, items_count) e contagem de itens. Use scope="team" apenas se admin/gestor pedir a equipe.', parameters: { type: 'object', properties: { status: { type: 'string' }, min_amount: { type: 'number' }, client_name: { type: 'string' }, days_back: { type: 'number' }, limit: { type: 'number' }, order_by: { type: 'string', enum: ['created_at','total_amount','items_count'] }, order_dir: { type: 'string', enum: ['asc','desc'] }, include_items_count: { type: 'boolean' }, scope: { type: 'string', enum: ['own','team'] } } } } },
    handler: async (args, { supabase, userId, profile }) => {
      const limit = Math.min(args?.limit || 50, 200);
      const wantItems = args?.include_items_count || args?.order_by === 'items_count';
      const cols = wantItems
        ? 'id, quote_number, client_name, total_amount, total, status, created_at, created_by, payment_method, payment_status, quote_items(count)'
        : 'id, quote_number, client_name, total_amount, total, status, created_at, created_by, payment_method, payment_status';
      let q = supabase.from('quotes').select(cols);
      q = scopeOwn(q, 'created_by', userId, profile, args?.scope);
      if (args?.status) q = q.eq('status', args.status);
      if (args?.min_amount) q = q.gte('total_amount', args.min_amount);
      if (args?.client_name) q = q.ilike('client_name', `%${args.client_name}%`);
      if (args?.days_back) q = q.gte('created_at', new Date(Date.now() - args.days_back * 86400000).toISOString());

      const orderBy = args?.order_by === 'items_count' ? 'created_at' : (args?.order_by || 'created_at');
      const ascending = args?.order_dir === 'asc';
      q = q.order(orderBy, { ascending }).limit(args?.order_by === 'items_count' ? 500 : limit);

      const { data, error } = await q;
      if (error) throw error;
      let rows: any[] = (data || []).map((r: any) => ({
        ...r,
        items_count: Array.isArray(r.quote_items) ? (r.quote_items[0]?.count ?? 0) : undefined,
      }));
      if (args?.order_by === 'items_count') {
        rows.sort((a, b) => (b.items_count || 0) - (a.items_count || 0) * (ascending ? -1 : 1));
        if (ascending) rows.reverse();
        rows = rows.slice(0, limit);
      }
      const columns = wantItems
        ? ['quote_number','client_name','items_count','total_amount','status','created_at']
        : ['quote_number','client_name','total_amount','status','created_at'];
      return { entity: 'quotes', scope: args?.scope || 'own', columns, rows, count: rows.length };
    },
  },
  get_quote_details: {
    schema: { type: 'function', function: { name: 'get_quote_details', description: 'Detalhes completos de um orçamento (itens, totais). Use quando a pergunta for sobre UM orçamento específico.', parameters: { type: 'object', required: ['quote_id_or_number'], properties: { quote_id_or_number: { type: 'string' } } } } },
    handler: async (args, { supabase }) => {
      const key = String(args.quote_id_or_number);
      const isUuid = /^[0-9a-f-]{36}$/i.test(key);
      let q = supabase.from('quotes').select('id, quote_number, client_name, total_amount, total, status, created_at, created_by, payment_method, payment_status, quote_items(*)').limit(1);
      q = isUuid ? q.eq('id', key) : q.eq('quote_number', key);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      if (!data) return { entity: 'quote', found: false };
      return { entity: 'quote', found: true, quote: data, items_count: data.quote_items?.length || 0 };
    },
  },
  get_products: {
    schema: { type: 'function', function: { name: 'get_products', description: 'Buscar produtos por nome, marca ou categoria.', parameters: { type: 'object', properties: { search: { type: 'string' }, brand: { type: 'string' }, category: { type: 'string' }, limit: { type: 'number' } } } } },
    handler: async (args, { supabase }) => {
      const limit = Math.min(args?.limit || 50, 200);
      let q = supabase.from('products').select('id, name, code, sku, brand, category_principal, price, level').limit(limit);
      if (args?.search) q = q.or(`name.ilike.%${args.search}%,code.ilike.%${args.search}%,sku.ilike.%${args.search}%`);
      if (args?.brand) q = q.ilike('brand', `%${args.brand}%`);
      if (args?.category) q = q.ilike('category_principal', `%${args.category}%`);
      const { data, error } = await q.order('name');
      if (error) throw error;
      return { entity: 'products', columns: ['name', 'code', 'brand', 'category_principal', 'price'], rows: data, count: data?.length || 0 };
    },
  },
  get_metrics: {
    schema: { type: 'function', function: { name: 'get_metrics', description: 'Métricas: total, aprovados, receita, conversão, ranking.', parameters: { type: 'object', properties: { days_back: { type: 'number' } } } } },
    handler: async (args, { supabase }) => {
      const days = args?.days_back || 30;
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      const { data: quotes, error } = await supabase.from('quotes').select('id, total_amount, total, status, created_by').gte('created_at', cutoff);
      if (error) throw error;
      const total = quotes?.length || 0;
      const approved = quotes?.filter((q: any) => q.status === 'approved') || [];
      const revenue = approved.reduce((s: number, q: any) => s + Number(q.total_amount || q.total || 0), 0);
      const bySeller: Record<string, { count: number; revenue: number }> = {};
      for (const q of quotes || []) {
        const k = q.created_by || 'sem_vendedor';
        bySeller[k] ??= { count: 0, revenue: 0 };
        bySeller[k].count++;
        if (q.status === 'approved') bySeller[k].revenue += Number(q.total_amount || q.total || 0);
      }
      return { entity: 'metrics', summary: { period_days: days, total_quotes: total, approved: approved.length, revenue, conversion_pct: total ? Math.round((approved.length / total) * 1000) / 10 : 0 }, by_seller: bySeller };
    },
  },
  get_followups: {
    schema: { type: 'function', function: { name: 'get_followups', description: 'Follow-ups / tarefas atrasadas ou pendentes.', parameters: { type: 'object', properties: { overdue_only: { type: 'boolean' } } } } },
    handler: async (args, { supabase }) => {
      const now = new Date().toISOString();
      let q = supabase.from('tasks').select('id, title, due_date, status, assigned_to, client_id').limit(200);
      if (args?.overdue_only !== false) q = q.lt('due_date', now).neq('status', 'done');
      const { data, error } = await q.order('due_date');
      if (error) return { entity: 'followups', columns: ['title', 'due_date', 'status'], rows: [], count: 0, note: error.message };
      return { entity: 'followups', columns: ['title', 'due_date', 'status'], rows: data, count: data?.length || 0 };
    },
  },
  get_pipeline: {
    schema: { type: 'function', function: { name: 'get_pipeline', description: 'Visão do pipeline por estágio.', parameters: { type: 'object', properties: {} } } },
    handler: async (_a, { supabase }) => {
      const { data } = await supabase.from('quotes').select('id, quote_number, client_name, total_amount, status, created_at').in('status', ['draft','sent','negotiation','negociacao','pre_sale','contact_made']).limit(300).order('created_at', { ascending: false });
      const byStage: Record<string, { count: number; value: number }> = {};
      for (const q of data || []) {
        const s = q.status || 'draft';
        byStage[s] ??= { count: 0, value: 0 };
        byStage[s].count++;
        byStage[s].value += Number(q.total_amount || 0);
      }
      return { entity: 'pipeline', summary: byStage, columns: ['quote_number','client_name','total_amount','status'], rows: data, count: data?.length || 0 };
    },
  },
};

// ============================================================
// WRITE TOOLS — retornam PREVIEW; execução só após /confirm
// ============================================================
type WriteTool = {
  action_type: string;
  module: string;
  entity_type: string;
  permission?: (profile: any) => boolean;
  schema: any;
  buildPreview: (args: any, ctx: ToolCtx) => Promise<{ summary: string; details: any; payload: any }>;
  execute: (payload: any, ctx: ToolCtx) => Promise<any>;
};

const writeTools: Record<string, WriteTool> = {
  criar_cliente: {
    action_type: 'create_client', module: 'clients', entity_type: 'client',
    schema: { type: 'function', function: { name: 'criar_cliente', description: 'Cadastrar novo cliente no CRM. Requer confirmação.', parameters: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, company_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, cpf_cnpj: { type: 'string' }, city: { type: 'string' }, state: { type: 'string' }, notes: { type: 'string' } } } } },
    buildPreview: async (args, { userId, companyId }) => {
      const payload = { ...args, created_by: userId, company_id: companyId, pipeline_stage: 'lead', is_revenda: false, salesperson_id: userId };
      return { summary: `Cadastrar cliente "${args.company_name || args.name}"`, details: args, payload };
    },
    execute: async (payload, { supabase }) => {
      const { data, error } = await supabase.from('clients').insert(payload).select().single();
      if (error) throw new Error(error.message);
      return { ok: true, entity_type: 'client', entity_id: data.id, message: `Cliente ${data.company_name || data.name} criado.`, row: data };
    },
  },
  editar_cliente: {
    action_type: 'edit_client', module: 'clients', entity_type: 'client',
    schema: { type: 'function', function: { name: 'editar_cliente', description: 'Editar dados de um cliente existente.', parameters: { type: 'object', required: ['client_id'], properties: { client_id: { type: 'string' }, name: { type: 'string' }, company_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, city: { type: 'string' }, state: { type: 'string' }, notes: { type: 'string' } } } } },
    buildPreview: async (args, { supabase }) => {
      const { data: existing } = await supabase.from('clients').select('id, name, company_name').eq('id', args.client_id).maybeSingle();
      if (!existing) throw new Error('Cliente não encontrado');
      const { client_id, ...rest } = args;
      return { summary: `Editar cliente "${existing.company_name || existing.name}"`, details: rest, payload: { client_id, updates: rest } };
    },
    execute: async ({ client_id, updates }, { supabase }) => {
      const { data, error } = await supabase.from('clients').update(updates).eq('id', client_id).select().single();
      if (error) throw new Error(error.message);
      return { ok: true, entity_type: 'client', entity_id: client_id, message: `Cliente ${data.company_name || data.name} atualizado.`, row: data };
    },
  },
  transferir_carteira: {
    action_type: 'transfer_client', module: 'clients', entity_type: 'client',
    permission: (p) => ['admin', 'gestor'].includes(p?.role),
    schema: { type: 'function', function: { name: 'transferir_carteira', description: 'Transferir cliente para outro vendedor (apenas admin/gestor).', parameters: { type: 'object', required: ['client_id', 'new_salesperson_id'], properties: { client_id: { type: 'string' }, new_salesperson_id: { type: 'string' } } } } },
    buildPreview: async (args, { supabase }) => {
      const { data: c } = await supabase.from('clients').select('id, name, company_name').eq('id', args.client_id).maybeSingle();
      const { data: sp } = await supabase.from('profiles').select('user_id, full_name').eq('user_id', args.new_salesperson_id).maybeSingle();
      if (!c) throw new Error('Cliente não encontrado');
      if (!sp) throw new Error('Vendedor não encontrado');
      return { summary: `Transferir "${c.company_name || c.name}" para ${sp.full_name}`, details: { cliente: c.company_name || c.name, novo_vendedor: sp.full_name }, payload: args };
    },
    execute: async (args, { supabase }) => {
      const { error } = await supabase.from('clients').update({ salesperson_id: args.new_salesperson_id }).eq('id', args.client_id);
      if (error) throw new Error(error.message);
      return { ok: true, entity_type: 'client', entity_id: args.client_id, message: 'Carteira transferida.' };
    },
  },
  aprovar_orcamento: {
    action_type: 'approve_quote', module: 'quotes', entity_type: 'quote',
    schema: { type: 'function', function: { name: 'aprovar_orcamento', description: 'Aprovar um orçamento existente.', parameters: { type: 'object', required: ['quote_id'], properties: { quote_id: { type: 'string' } } } } },
    buildPreview: async (args, { supabase }) => {
      const { data } = await supabase.from('quotes').select('id, quote_number, client_name, total_amount, status').eq('id', args.quote_id).maybeSingle();
      if (!data) throw new Error('Orçamento não encontrado');
      return { summary: `Aprovar orçamento ${data.quote_number} — ${data.client_name}`, details: data, payload: args };
    },
    execute: async (args, { supabase }) => {
      const { error } = await supabase.from('quotes').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', args.quote_id);
      if (error) throw new Error(error.message);
      return { ok: true, entity_type: 'quote', entity_id: args.quote_id, message: 'Orçamento aprovado.' };
    },
  },
  cancelar_orcamento: {
    action_type: 'cancel_quote', module: 'quotes', entity_type: 'quote',
    schema: { type: 'function', function: { name: 'cancelar_orcamento', description: 'Cancelar/rejeitar um orçamento.', parameters: { type: 'object', required: ['quote_id'], properties: { quote_id: { type: 'string' }, reason: { type: 'string' } } } } },
    buildPreview: async (args, { supabase }) => {
      const { data } = await supabase.from('quotes').select('id, quote_number, client_name, status').eq('id', args.quote_id).maybeSingle();
      if (!data) throw new Error('Orçamento não encontrado');
      return { summary: `Cancelar orçamento ${data.quote_number}`, details: { ...data, motivo: args.reason }, payload: args };
    },
    execute: async (args, { supabase }) => {
      const { error } = await supabase.from('quotes').update({ status: 'rejected', rejected_at: new Date().toISOString() }).eq('id', args.quote_id);
      if (error) throw new Error(error.message);
      return { ok: true, entity_type: 'quote', entity_id: args.quote_id, message: 'Orçamento cancelado.' };
    },
  },
  duplicar_orcamento: {
    action_type: 'duplicate_quote', module: 'quotes', entity_type: 'quote',
    schema: { type: 'function', function: { name: 'duplicar_orcamento', description: 'Duplicar orçamento existente como novo rascunho.', parameters: { type: 'object', required: ['quote_id'], properties: { quote_id: { type: 'string' } } } } },
    buildPreview: async (args, { supabase }) => {
      const { data } = await supabase.from('quotes').select('id, quote_number, client_name, total_amount').eq('id', args.quote_id).maybeSingle();
      if (!data) throw new Error('Orçamento não encontrado');
      return { summary: `Duplicar orçamento ${data.quote_number}`, details: data, payload: args };
    },
    execute: async (args, { supabase, userId }) => {
      const { data: src, error: e1 } = await supabase.from('quotes').select('*').eq('id', args.quote_id).single();
      if (e1) throw new Error(e1.message);
      const { id, quote_number, created_at, updated_at, approved_at, rejected_at, public_token, ...rest } = src;
      const { data: newQ, error } = await supabase.from('quotes').insert({ ...rest, status: 'draft', created_by: userId }).select().single();
      if (error) throw new Error(error.message);
      const { data: items } = await supabase.from('quote_items').select('*').eq('quote_id', args.quote_id);
      if (items?.length) {
        const rows = items.map((it: any) => { const { id, quote_id, created_at, updated_at, ...r } = it; return { ...r, quote_id: newQ.id }; });
        await supabase.from('quote_items').insert(rows);
      }
      return { ok: true, entity_type: 'quote', entity_id: newQ.id, message: `Orçamento duplicado: ${newQ.quote_number}.`, row: newQ };
    },
  },
  mover_pipeline: {
    action_type: 'move_pipeline', module: 'quotes', entity_type: 'quote',
    schema: { type: 'function', function: { name: 'mover_pipeline', description: 'Mover orçamento para nova etapa do pipeline.', parameters: { type: 'object', required: ['quote_id', 'new_status'], properties: { quote_id: { type: 'string' }, new_status: { type: 'string', description: 'draft, sent, negotiation, pre_sale, contact_made, approved, rejected' } } } } },
    buildPreview: async (args, { supabase }) => {
      const { data } = await supabase.from('quotes').select('id, quote_number, client_name, status').eq('id', args.quote_id).maybeSingle();
      if (!data) throw new Error('Orçamento não encontrado');
      return { summary: `Mover ${data.quote_number} de "${data.status}" para "${args.new_status}"`, details: { ...data, novo_status: args.new_status }, payload: args };
    },
    execute: async (args, { supabase }) => {
      const { error } = await supabase.from('quotes').update({ status: args.new_status }).eq('id', args.quote_id);
      if (error) throw new Error(error.message);
      return { ok: true, entity_type: 'quote', entity_id: args.quote_id, message: `Pipeline atualizado para ${args.new_status}.` };
    },
  },
  criar_tarefa: {
    action_type: 'create_task', module: 'tasks', entity_type: 'task',
    schema: { type: 'function', function: { name: 'criar_tarefa', description: 'Criar tarefa/follow-up.', parameters: { type: 'object', required: ['title'], properties: { title: { type: 'string' }, description: { type: 'string' }, due_date: { type: 'string', description: 'YYYY-MM-DD' }, client_id: { type: 'string' }, assigned_to: { type: 'string' } } } } },
    buildPreview: async (args, { userId }) => {
      const payload = { title: args.title, description: args.description, due_date: args.due_date, client_id: args.client_id, assigned_to: args.assigned_to || userId, created_by: userId, status: 'todo' };
      return { summary: `Criar tarefa "${args.title}"${args.due_date ? ` para ${args.due_date}` : ''}`, details: payload, payload };
    },
    execute: async (payload, { supabase }) => {
      const { data, error } = await supabase.from('tasks').insert(payload).select().single();
      if (error) throw new Error(error.message);
      return { ok: true, entity_type: 'task', entity_id: data.id, message: `Tarefa criada.`, row: data };
    },
  },
  atribuir_tarefa: {
    action_type: 'assign_task', module: 'tasks', entity_type: 'task',
    schema: { type: 'function', function: { name: 'atribuir_tarefa', description: 'Atribuir tarefa a outro usuário.', parameters: { type: 'object', required: ['task_id', 'assigned_to'], properties: { task_id: { type: 'string' }, assigned_to: { type: 'string' } } } } },
    buildPreview: async (args, { supabase }) => {
      const { data } = await supabase.from('tasks').select('id, title').eq('id', args.task_id).maybeSingle();
      const { data: sp } = await supabase.from('profiles').select('full_name').eq('user_id', args.assigned_to).maybeSingle();
      if (!data) throw new Error('Tarefa não encontrada');
      return { summary: `Atribuir "${data.title}" para ${sp?.full_name || args.assigned_to}`, details: { tarefa: data.title, novo_responsavel: sp?.full_name }, payload: args };
    },
    execute: async (args, { supabase }) => {
      const { error } = await supabase.from('tasks').update({ assigned_to: args.assigned_to }).eq('id', args.task_id);
      if (error) throw new Error(error.message);
      return { ok: true, entity_type: 'task', entity_id: args.task_id, message: 'Tarefa atribuída.' };
    },
  },
  agendar_retorno: {
    action_type: 'schedule_followup', module: 'clients', entity_type: 'client',
    schema: { type: 'function', function: { name: 'agendar_retorno', description: 'Agendar retorno/contato com cliente (cria tarefa vinculada).', parameters: { type: 'object', required: ['client_id', 'when'], properties: { client_id: { type: 'string' }, when: { type: 'string', description: 'YYYY-MM-DD' }, notes: { type: 'string' } } } } },
    buildPreview: async (args, { supabase }) => {
      const { data } = await supabase.from('clients').select('id, name, company_name').eq('id', args.client_id).maybeSingle();
      if (!data) throw new Error('Cliente não encontrado');
      const payload = { title: `Retorno: ${data.company_name || data.name}`, description: args.notes, due_date: args.when, client_id: args.client_id, status: 'todo' };
      return { summary: `Agendar retorno com ${data.company_name || data.name} para ${args.when}`, details: payload, payload };
    },
    execute: async (payload, { supabase, userId }) => {
      const { data, error } = await supabase.from('tasks').insert({ ...payload, created_by: userId, assigned_to: userId }).select().single();
      if (error) throw new Error(error.message);
      return { ok: true, entity_type: 'task', entity_id: data.id, message: 'Retorno agendado.' };
    },
  },
};

const allToolSchemas = [
  ...Object.values(readTools).map(t => t.schema),
  ...Object.values(writeTools).map(t => t.schema),
];

// ============================================================
// Auditoria
// ============================================================
async function insertAudit(service: any, row: any) {
  const { data, error } = await service.from('assistant_audit_log').insert(row).select('id').single();
  if (error) { console.error('[audit] insert error', error); return null; }
  return data.id;
}
async function updateAudit(service: any, id: string, patch: any) {
  await service.from('assistant_audit_log').update(patch).eq('id', id);
}

// ============================================================
// Classifier (hybrid mode — mantido)
// ============================================================
const GPT_KEYWORDS = ['analise','análise','analisar','resumo','resuma','estratégia','previsão','sugira','recomende','cross sell','upsell','compare','escreva','redija','e-mail','email','proposta comercial','por que','porque','explique','interprete','crie','cadastr','edit','aprovar','cancel','mover','duplicar','transferir','agendar','atribuir'];
function normalize(s: string) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w\s%$]/g,' ').replace(/\s+/g,' ').trim(); }
function classify(raw: string): { mode: 'sql'; tool: string; args: any; label: string } | { mode: 'gpt' } {
  const q = normalize(raw);
  for (const kw of GPT_KEYWORDS) if (q.includes(normalize(kw))) return { mode: 'gpt' };
  const daysBack = (q.match(/(\d{1,3})\s+dias?/) || [])[1];
  if (/\bclientes?\b/.test(q) && /inativ|sem\s+comprar|sem\s+compra/.test(q))
    return { mode: 'sql', tool: 'get_clients', args: { days_inactive: daysBack ? +daysBack : 180, limit: 200 }, label: 'Clientes sem compra recente' };
  if (/\bclientes?\b/.test(q)) return { mode: 'sql', tool: 'get_clients', args: { limit: 200 }, label: 'Clientes' };
  if (/\borcament|\bpropost|\bquote/.test(q)) {
    const args: any = { limit: 200 };
    if (/aprovad/.test(q)) args.status = 'approved';
    else if (/negocia/.test(q)) args.status = 'negotiation';
    if (daysBack) args.days_back = +daysBack;
    return { mode: 'sql', tool: 'get_quotes', args, label: 'Orçamentos' };
  }
  if (/\bprodutos?\b/.test(q)) return { mode: 'sql', tool: 'get_products', args: { limit: 200 }, label: 'Produtos' };
  if (/follow[- ]?up|tarefa|atrasad/.test(q)) return { mode: 'sql', tool: 'get_followups', args: {}, label: 'Follow-ups' };
  if (/\bpipeline\b|funil/.test(q)) return { mode: 'sql', tool: 'get_pipeline', args: {}, label: 'Pipeline' };
  if (/metric|convers|receita|ranking|ticket|faturament/.test(q)) return { mode: 'sql', tool: 'get_metrics', args: { days_back: daysBack ? +daysBack : 30 }, label: 'Métricas' };
  return { mode: 'gpt' };
}

const sqlCache = new Map<string, { at: number; payload: any }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function humanizeSqlResult(label: string, tool: string, result: any): string {
  if (tool === 'get_metrics' && result?.summary) {
    const s = result.summary;
    return `Métricas dos últimos ${s.period_days} dias: ${s.total_quotes} orçamentos, ${s.approved} aprovados (${s.conversion_pct}%), receita ${Number(s.revenue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`;
  }
  const n = result?.count ?? 0;
  const map: Record<string, string> = { clients: 'clientes', quotes: 'orçamentos', products: 'produtos', followups: 'follow-ups', pipeline: 'itens no pipeline' };
  const noun = map[result?.entity] || 'registros';
  if (n === 0) return `Nenhum ${noun.replace(/s$/, '')} encontrado.`;
  return `${label}: ${n} ${noun}.`;
}

function openAiError(aiRes: Response, errText: string) {
  let parsed: any = null; try { parsed = JSON.parse(errText); } catch {}
  const type = parsed?.error?.type, code = parsed?.error?.code;
  const isQuota = type === 'insufficient_quota' || code === 'insufficient_quota';
  return {
    friendly: 'Assistente temporariamente indisponível. Use os botões de ação rápida ou peça consultas diretas (clientes, orçamentos, produtos, métricas).',
    error_code: isQuota ? 'OPENAI_QUOTA_EXCEEDED' : aiRes.status === 429 ? 'OPENAI_RATE_LIMIT' : 'OPENAI_ERROR',
    detail: parsed?.error?.message || errText,
  };
}

async function generateTitle(userText: string): Promise<string> {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: OPENAI_TITLE_MODEL, messages: [{ role: 'system', content: 'Título curto (máx 5 palavras, PT-BR, sem aspas).' }, { role: 'user', content: userText.slice(0, 500) }], max_tokens: 20 }),
    });
    if (!r.ok) return userText.slice(0, 60);
    const j = await r.json();
    return (j.choices?.[0]?.message?.content || '').trim().replace(/^["'\.]+|["'\.]+$/g, '') || userText.slice(0, 60);
  } catch { return userText.slice(0, 60); }
}

// ============================================================
// SERVER
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/assistant-commercial/, '');
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
  const userAgent = req.headers.get('user-agent') || '';

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: authHeader } } });
    const service = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const userId = userData.user.id;
    const { data: profile } = await supabase.from('profiles').select('full_name, role, company_id, permissions').eq('user_id', userId).maybeSingle();
    const companyId = profile?.company_id ?? null;

    // ---------- /confirm endpoint ----------
    if (path === '/confirm' || path.endsWith('/confirm')) {
      const { action_id, decision } = await req.json();
      if (!action_id || !['confirm', 'cancel'].includes(decision))
        return new Response(JSON.stringify({ error: 'invalid params' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: audit } = await service.from('assistant_audit_log').select('*').eq('id', action_id).maybeSingle();
      if (!audit) return new Response(JSON.stringify({ error: 'action not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (audit.user_id !== userId) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (audit.execution_status !== 'waiting_confirmation')
        return new Response(JSON.stringify({ error: 'action already resolved', status: audit.execution_status }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const ageMs = Date.now() - new Date(audit.created_at).getTime();
      if (ageMs > 10 * 60 * 1000) {
        await updateAudit(service, action_id, { execution_status: 'cancelled', confirmation_result: 'expired' });
        return new Response(JSON.stringify({ error: 'expired' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (decision === 'cancel') {
        await updateAudit(service, action_id, { execution_status: 'cancelled', confirmation_result: 'cancelled' });
        return new Response(JSON.stringify({ ok: true, cancelled: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const tool = writeTools[audit.tool_name];
      if (!tool) return new Response(JSON.stringify({ error: 'unknown tool' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const started = Date.now();
      const ctx: ToolCtx = { supabase, service, userId, companyId, profile, ip, userAgent, conversationId: audit.conversation_id };
      try {
        const payload = (audit.tool_input as any)?.payload ?? audit.tool_input;
        const result = await tool.execute(payload, ctx);
        await updateAudit(service, action_id, { execution_status: 'executed', confirmation_result: 'confirmed', execution_time_ms: Date.now() - started, tool_output: result, entity_id: result.entity_id ?? null });
        // persist assistant message with the executed result
        if (audit.conversation_id) {
          await supabase.from('assistant_messages').insert({ conversation_id: audit.conversation_id, role: 'assistant', content: result.message || 'Ação executada.', model: 'action:executed', tool_name: audit.tool_name, tool_result: { executed: true, ...result } });
        }
        return new Response(JSON.stringify({ ok: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e: any) {
        await updateAudit(service, action_id, { execution_status: 'failed', confirmation_result: 'confirmed', execution_time_ms: Date.now() - started, tool_output: { error: e.message } });
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ---------- normal chat request ----------
    if (!OPENAI_API_KEY) return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const started = Date.now();
    const body = await req.json();
    const { message, conversation_id, context } = body as { message: string; conversation_id?: string | null; context?: any };
    if (!message || typeof message !== 'string') return new Response(JSON.stringify({ error: 'message is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let convId = conversation_id || null;
    let isNew = false;
    if (!convId) {
      const { data: created, error: cErr } = await supabase.from('assistant_conversations').insert({ user_id: userId, company_id: companyId, title: message.slice(0, 60), question: message.slice(0, 500) }).select('id').single();
      if (cErr) throw cErr;
      convId = created.id; isNew = true;
    }

    const { data: prior } = await supabase.from('assistant_messages').select('role, content, tool_name, tool_args, tool_result').eq('conversation_id', convId).order('created_at', { ascending: true }).limit(40);
    await supabase.from('assistant_messages').insert({ conversation_id: convId, role: 'user', content: message });

    // Hybrid SQL fast path
    const cls = classify(message);
    if (cls.mode === 'sql') {
      const key = `${userId}:${cls.tool}:${JSON.stringify(cls.args)}`;
      const cached = sqlCache.get(key);
      let result: any, fromCache = false;
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) { result = cached.payload; fromCache = true; }
      else {
        try {
          result = await readTools[cls.tool].handler(cls.args, { supabase, service, userId, companyId, profile, context, ip, userAgent, conversationId: convId });
          sqlCache.set(key, { at: Date.now(), payload: result });
        } catch (e: any) { result = { error: e.message }; }
      }
      const answer = humanizeSqlResult(cls.label, cls.tool, result);
      const elapsed = Date.now() - started;
      await supabase.from('assistant_messages').insert({ conversation_id: convId, role: 'assistant', content: answer, model: fromCache ? 'sql:cache' : 'sql', execution_time_ms: elapsed, tool_name: cls.tool, tool_result: result });
      await supabase.from('assistant_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);
      if (isNew) await supabase.from('assistant_conversations').update({ title: cls.label.slice(0, 60) }).eq('id', convId);
      return new Response(JSON.stringify({ conversation_id: convId, answer, tool_used: cls.tool, result, mode: fromCache ? 'sql_cache' : 'sql' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GPT path
    const contextBlock = `Contexto:
- Usuário: ${profile?.full_name ?? userId} (perfil: ${profile?.role ?? 'n/d'})
- Empresa: ${companyId ?? 'n/d'}
- Página atual: ${context?.route ?? context?.module ?? 'n/d'}
- Cliente aberto: ${context?.client ? JSON.stringify(context.client) : 'nenhum'}
- Orçamento aberto: ${context?.quote ? JSON.stringify(context.quote) : 'nenhum'}`;

    const systemPrompt = `Você é o Copiloto Comercial do CRM MCI. Consulte SEMPRE ferramentas para dados reais.
Regras críticas de execução:
- Ferramentas de LEITURA (get_*) executam direto.
- Ferramentas de AÇÃO/ESCRITA (criar_*, editar_*, aprovar_*, cancelar_*, duplicar_*, mover_*, transferir_*, agendar_*, atribuir_*) NÃO executam imediatamente: elas retornam uma prévia. Após a prévia, ENCERRE sua resposta pedindo confirmação — nunca chame a mesma ferramenta de novo no mesmo turno.
- Nunca invente dados. Se faltar informação essencial (ex.: id do cliente), pergunte.
- Responda em português, executivo, sem emojis.
- Data: ${new Date().toISOString().slice(0, 10)}.
${contextBlock}`;

    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    for (const m of prior || []) if (m.role === 'user' || m.role === 'assistant') messages.push({ role: m.role, content: m.content || '' });
    messages.push({ role: 'user', content: message });

    let promptTokens = 0, completionTokens = 0, totalTokens = 0;
    let previewPayload: any = null;

    for (let step = 0; step < 4; step++) {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: OPENAI_MODEL, messages, tools: allToolSchemas, tool_choice: 'auto' }),
      });
      if (!aiRes.ok) {
        const err = openAiError(aiRes, await aiRes.text());
        await supabase.from('assistant_messages').insert({ conversation_id: convId, role: 'assistant', content: err.friendly, model: OPENAI_MODEL, error: err.detail, execution_time_ms: Date.now() - started });
        return new Response(JSON.stringify({ conversation_id: convId, answer: err.friendly, tool_used: null, result: null, error_code: err.error_code }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const aiJson = await aiRes.json();
      const msg = aiJson.choices?.[0]?.message;
      if (aiJson.usage) { promptTokens += aiJson.usage.prompt_tokens || 0; completionTokens += aiJson.usage.completion_tokens || 0; totalTokens += aiJson.usage.total_tokens || 0; }
      if (!msg) break;
      messages.push(msg);

      if (msg.tool_calls?.length) {
        for (const call of msg.tool_calls) {
          const name = call.function.name;
          const args = JSON.parse(call.function.arguments || '{}');
          const readTool = readTools[name];
          const writeTool = writeTools[name];
          const ctx: ToolCtx = { supabase, service, userId, companyId, profile, context, ip, userAgent, conversationId: convId };

          if (readTool) {
            let result: any;
            try { result = await readTool.handler(args, ctx); } catch (e: any) { result = { error: e.message }; }
            await supabase.from('assistant_messages').insert({ conversation_id: convId, role: 'tool', tool_name: name, tool_args: args, tool_result: result });
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 12000) });
          } else if (writeTool) {
            // Permissão
            if (writeTool.permission && !writeTool.permission(profile)) {
              const err = { error: 'Sem permissão para executar esta ação.' };
              messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(err) });
              continue;
            }
            try {
              const preview = await writeTool.buildPreview(args, ctx);
              const auditId = await insertAudit(service, {
                company_id: companyId, user_id: userId, conversation_id: convId,
                action_type: writeTool.action_type, tool_name: name, module: writeTool.module, entity_type: writeTool.entity_type,
                prompt: message, tool_input: { args, payload: preview.payload },
                confirmation_required: true, execution_status: 'waiting_confirmation',
                model: OPENAI_MODEL, provider: 'openai',
                ip, user_agent: userAgent,
              });
              previewPayload = { preview: true, action_id: auditId, action_type: writeTool.action_type, tool_name: name, summary: preview.summary, details: preview.details };
              messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ preview: true, summary: preview.summary, note: 'Aguardando confirmação do usuário. Não repita esta ferramenta.' }) });
            } catch (e: any) {
              messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: e.message }) });
            }
          } else {
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: `tool ${name} não implementada` }) });
          }
        }
        continue;
      }

      const answer = msg.content || (previewPayload ? previewPayload.summary : '');
      const elapsed = Date.now() - started;
      await supabase.from('assistant_messages').insert({
        conversation_id: convId, role: 'assistant', content: answer, model: OPENAI_MODEL,
        prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens,
        execution_time_ms: elapsed,
        tool_name: previewPayload?.tool_name || null,
        tool_result: previewPayload || null,
      });
      await supabase.from('assistant_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);
      if (isNew) { const title = await generateTitle(message); await supabase.from('assistant_conversations').update({ title }).eq('id', convId); }

      return new Response(JSON.stringify({ conversation_id: convId, answer, tool_used: previewPayload?.tool_name || null, result: previewPayload, preview: !!previewPayload }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ conversation_id: convId, answer: 'Não foi possível concluir a análise.', result: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[assistant-commercial]', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
