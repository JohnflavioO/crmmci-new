// ================================================================
// CRM Shared Handlers (single source of truth)
// Used by both the MCP server (src/lib/mcp/tools/*) and by the
// assistant-commercial Edge Function. NO external deps — supabase
// client is injected so this module works in Deno and Node/Vite.
// ================================================================

export type CrmCtx = {
  supabase: any;              // JWT-scoped supabase client (RLS applies)
  userId: string;
  profile?: any;
  companyId?: string | null;
};

export type CrmEnvelope = {
  ok: boolean;
  entity: string;
  columns?: string[];
  rows?: any[];
  count?: number;
  summary?: any;
  data?: any;
  error?: string;
};

const APPROVED_STATUSES = ["approved", "aprovado", "aprovada", "won", "closed_won"];

const okEnv = (entity: string, extra: Partial<CrmEnvelope> = {}): CrmEnvelope => ({
  ok: true,
  entity,
  ...extra,
});
const errEnv = (entity: string, error: string): CrmEnvelope => ({ ok: false, entity, error });

// Scope helper: admin/gestor podem pedir scope='team' para ampliar; caso contrário, restringe.
function scopeOwn(query: any, column: string, ctx: CrmCtx, scope?: string) {
  const role = ctx.profile?.role;
  const isBoss = role === "admin" || role === "gestor";
  if (isBoss && scope === "team") return query;
  return query.eq(column, ctx.userId);
}

// -----------------------------------------------------------------
// Clients
// -----------------------------------------------------------------
export async function listClients(ctx: CrmCtx, args: { search?: string; limit?: number; scope?: string } = {}): Promise<CrmEnvelope> {
  const limit = Math.min(args.limit ?? 25, 200);
  let q = ctx.supabase
    .from("clients")
    .select("id,name,company_name,email,phone,city,state,salesperson_id,created_by,last_interaction_at,created_at")
    .order("company_name", { ascending: true })
    .limit(limit);
  q = scopeOwn(q, "salesperson_id", ctx, args.scope);
  if (args.search) {
    const like = `%${args.search}%`;
    q = q.or(`name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
  }
  const { data, error } = await q;
  if (error) return errEnv("clients", error.message);
  return okEnv("clients", {
    columns: ["company_name", "name", "city", "state", "email", "phone"],
    rows: data ?? [],
    count: data?.length ?? 0,
  });
}

export async function searchClients(ctx: CrmCtx, args: { query: string; limit?: number }): Promise<CrmEnvelope> {
  const limit = Math.min(args.limit ?? 20, 50);
  const like = `%${args.query}%`;
  const { data, error } = await ctx.supabase
    .from("clients")
    .select("id,name,company_name,email,phone,city,state,cpf_cnpj,created_at")
    .or(`name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like},city.ilike.${like},cpf_cnpj.ilike.${like}`)
    .limit(limit);
  if (error) return errEnv("clients", error.message);
  return okEnv("clients", { rows: data ?? [], count: data?.length ?? 0 });
}

export async function getCustomerHistory(ctx: CrmCtx, args: { client_id?: string; client_name?: string }): Promise<CrmEnvelope> {
  if (!args.client_id && !args.client_name) return errEnv("client_history", "Informe client_id ou client_name");
  let client: any = null;
  if (args.client_id) {
    const { data } = await ctx.supabase.from("clients").select("*").eq("id", args.client_id).maybeSingle();
    client = data;
  } else {
    const { data } = await ctx.supabase.from("clients").select("*").ilike("name", `%${args.client_name}%`).limit(1).maybeSingle();
    client = data;
  }
  if (!client) return errEnv("client_history", "Cliente não encontrado");
  const [q, c, f] = await Promise.all([
    ctx.supabase.from("quotes").select("id,quote_number,status,total,total_amount,created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(50),
    ctx.supabase.from("generated_contracts").select("id,status,created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(20),
    ctx.supabase.from("financial_records").select("id,status,amount,due_date").eq("client_id", client.id).order("due_date", { ascending: false }).limit(50),
  ]);
  return okEnv("client_history", {
    data: { client, quotes: q.data ?? [], contracts: c.data ?? [], financial: f.data ?? [] },
  });
}

// -----------------------------------------------------------------
// Products
// -----------------------------------------------------------------
export async function searchProducts(ctx: CrmCtx, args: { query?: string; search?: string; brand?: string; category?: string; limit?: number } = {}): Promise<CrmEnvelope> {
  const term = args.query ?? args.search;
  const limit = Math.min(args.limit ?? 25, 200);
  let q = ctx.supabase
    .from("products")
    .select("id,name,code,sku,brand,category_principal,price,level")
    .order("name", { ascending: true })
    .limit(limit);
  if (term) {
    const like = `%${term}%`;
    q = q.or(`name.ilike.${like},code.ilike.${like},sku.ilike.${like},brand.ilike.${like},description.ilike.${like}`);
  }
  if (args.brand) q = q.ilike("brand", `%${args.brand}%`);
  if (args.category) q = q.ilike("category_principal", `%${args.category}%`);
  const { data, error } = await q;
  if (error) return errEnv("products", error.message);
  return okEnv("products", {
    columns: ["name", "code", "brand", "category_principal", "price"],
    rows: data ?? [],
    count: data?.length ?? 0,
  });
}

export async function getProductDetails(ctx: CrmCtx, args: { id: string }): Promise<CrmEnvelope> {
  const { data, error } = await ctx.supabase.from("products").select("*").eq("id", args.id).maybeSingle();
  if (error) return errEnv("product", error.message);
  if (!data) return errEnv("product", "Produto não encontrado");
  return okEnv("product", { data });
}

// -----------------------------------------------------------------
// Quotes
// -----------------------------------------------------------------
export async function listQuotes(ctx: CrmCtx, args: { status?: string; limit?: number; scope?: string } = {}): Promise<CrmEnvelope> {
  const limit = Math.min(args.limit ?? 25, 200);
  let q = ctx.supabase
    .from("quotes")
    .select("id,quote_number,client_name,status,total,total_amount,created_at,created_by")
    .order("quote_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  q = scopeOwn(q, "created_by", ctx, args.scope);
  if (args.status) q = q.eq("status", args.status);
  const { data, error } = await q;
  if (error) return errEnv("quotes", error.message);
  return okEnv("quotes", {
    columns: ["quote_number", "client_name", "total_amount", "status", "created_at"],
    rows: data ?? [],
    count: data?.length ?? 0,
  });
}

export async function searchQuotes(ctx: CrmCtx, args: { client_name?: string; status?: string; from?: string; to?: string; limit?: number; scope?: string }): Promise<CrmEnvelope> {
  const limit = Math.min(args.limit ?? 25, 200);
  let q = ctx.supabase
    .from("quotes")
    .select("id,quote_number,client_name,status,total,total_amount,created_at,created_by")
    .order("created_at", { ascending: false })
    .limit(limit);
  q = scopeOwn(q, "created_by", ctx, args.scope);
  if (args.client_name) q = q.ilike("client_name", `%${args.client_name}%`);
  if (args.status) q = q.eq("status", args.status);
  if (args.from) q = q.gte("created_at", args.from);
  if (args.to) q = q.lte("created_at", args.to);
  const { data, error } = await q;
  if (error) return errEnv("quotes", error.message);
  return okEnv("quotes", { rows: data ?? [], count: data?.length ?? 0 });
}

// -----------------------------------------------------------------
// Pipeline / Dashboard / Sales metrics
// -----------------------------------------------------------------
export async function getPipeline(ctx: CrmCtx, args: { scope?: string } = {}): Promise<CrmEnvelope> {
  let q = ctx.supabase
    .from("quotes")
    .select("id,quote_number,client_name,status,total,total_amount,created_at,created_by")
    .in("status", ["draft", "sent", "negotiation", "negociacao", "pre_sale", "contact_made"])
    .order("created_at", { ascending: false })
    .limit(500);
  q = scopeOwn(q, "created_by", ctx, args.scope);
  const { data, error } = await q;
  if (error) return errEnv("pipeline", error.message);
  const byStage: Record<string, { count: number; value: number; items: any[] }> = {};
  for (const r of data ?? []) {
    const s = (r as any).status ?? "sem_status";
    byStage[s] ??= { count: 0, value: 0, items: [] };
    byStage[s].count += 1;
    byStage[s].value += Number((r as any).total_amount ?? (r as any).total ?? 0);
    if (byStage[s].items.length < 20) byStage[s].items.push(r);
  }
  return okEnv("pipeline", { summary: byStage, rows: data ?? [], count: data?.length ?? 0 });
}

export async function getDashboard(ctx: CrmCtx): Promise<CrmEnvelope> {
  const [clientsRes, quotesRes] = await Promise.all([
    ctx.supabase.from("clients").select("id", { count: "exact", head: true }),
    ctx.supabase.from("quotes").select("status,total,total_amount,created_at").limit(2000),
  ]);
  if (quotesRes.error) return errEnv("dashboard", quotesRes.error.message);
  const byStatus: Record<string, { count: number; total: number }> = {};
  let grand = 0;
  for (const q of quotesRes.data ?? []) {
    const s = (q as any).status ?? "sem_status";
    const v = Number((q as any).total_amount ?? (q as any).total ?? 0);
    byStatus[s] ??= { count: 0, total: 0 };
    byStatus[s].count += 1;
    byStatus[s].total += v;
    grand += v;
  }
  return okEnv("dashboard", {
    summary: {
      total_clients: clientsRes.count ?? 0,
      total_quotes: quotesRes.data?.length ?? 0,
      forecast_total: grand,
      quotes_by_status: byStatus,
    },
  });
}

export async function getSalesMetrics(ctx: CrmCtx, args: { from?: string; to?: string; days_back?: number; scope?: string } = {}): Promise<CrmEnvelope> {
  const from = args.from ?? (args.days_back ? new Date(Date.now() - args.days_back * 86400000).toISOString() : undefined);
  let q = ctx.supabase
    .from("quotes")
    .select("id,status,total,total_amount,client_name,created_at,created_by")
    .in("status", APPROVED_STATUSES)
    .limit(5000);
  q = scopeOwn(q, "created_by", ctx, args.scope);
  if (from) q = q.gte("created_at", from);
  if (args.to) q = q.lte("created_at", args.to);
  const { data, error } = await q;
  if (error) return errEnv("sales_metrics", error.message);
  const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.total_amount ?? r.total ?? 0), 0);
  const count = data?.length ?? 0;
  return okEnv("sales_metrics", {
    summary: {
      approved_count: count,
      revenue_total: total,
      average_ticket: count ? total / count : 0,
      period: { from: from ?? null, to: args.to ?? null },
    },
  });
}

// -----------------------------------------------------------------
// Top products (produtos mais vendidos)
// -----------------------------------------------------------------
export async function getTopProducts(ctx: CrmCtx, args: {
  from?: string; to?: string; days_back?: number;
  metric?: "quantity" | "revenue"; limit?: number;
  brand?: string; scope?: string;
} = {}): Promise<CrmEnvelope> {
  const limit = Math.min(args.limit ?? 10, 50);
  const metric = args.metric ?? "revenue";
  const from = args.from ?? (args.days_back ? new Date(Date.now() - args.days_back * 86400000).toISOString() : undefined);

  // 1) approved quotes (RLS-scoped) matching filters
  let qq = ctx.supabase
    .from("quotes")
    .select("id,created_by,created_at,status")
    .in("status", APPROVED_STATUSES)
    .limit(5000);
  qq = scopeOwn(qq, "created_by", ctx, args.scope);
  if (from) qq = qq.gte("created_at", from);
  if (args.to) qq = qq.lte("created_at", args.to);
  const { data: quotes, error: qErr } = await qq;
  if (qErr) return errEnv("top_products", qErr.message);
  if (!quotes || quotes.length === 0) {
    return okEnv("top_products", { rows: [], count: 0, summary: { metric, period: { from: from ?? null, to: args.to ?? null } } });
  }
  const quoteIds = quotes.map((q: any) => q.id);

  // 2) aggregate items (quote_items has no product_id → key by code/description)
  let ii = ctx.supabase
    .from("quote_items")
    .select("quote_id,code,product_code,description,brand,quantity,line_total,total_price,unit_total,unit_price")
    .in("quote_id", quoteIds)
    .limit(20000);
  if (args.brand) ii = ii.ilike("brand", `%${args.brand}%`);
  const { data: items, error: iErr } = await ii;
  if (iErr) return errEnv("top_products", iErr.message);

  const agg: Record<string, { key: string; code: string | null; name: string; brand: string | null; quantity: number; revenue: number; quotes: Set<string> }> = {};
  for (const it of items ?? []) {
    const code = (it as any).product_code || (it as any).code || null;
    const name = (it as any).description || code || "(sem descrição)";
    const key = (code || name).toLowerCase();
    const qty = Number((it as any).quantity ?? 0);
    const rev = Number((it as any).line_total ?? (it as any).total_price ?? (it as any).unit_total ?? (Number((it as any).unit_price ?? 0) * qty));
    agg[key] ??= { key, code, name, brand: (it as any).brand ?? null, quantity: 0, revenue: 0, quotes: new Set() };
    agg[key].quantity += qty;
    agg[key].revenue += rev;
    agg[key].quotes.add((it as any).quote_id);
  }
  const rows = Object.values(agg)
    .map((r, idx) => ({
      ranking_position: idx + 1,
      product_code: r.code,
      product_name: r.name,
      brand: r.brand,
      quantity_sold: r.quantity,
      revenue: r.revenue,
      approved_quotes_count: r.quotes.size,
    }))
    .sort((a, b) => metric === "quantity" ? b.quantity_sold - a.quantity_sold : b.revenue - a.revenue)
    .slice(0, limit)
    .map((r, idx) => ({ ...r, ranking_position: idx + 1 }));

  return okEnv("top_products", {
    columns: ["ranking_position", "product_name", "brand", "quantity_sold", "revenue", "approved_quotes_count"],
    rows,
    count: rows.length,
    summary: { metric, period: { from: from ?? null, to: args.to ?? null }, approved_quotes_scanned: quotes.length },
  });
}

// -----------------------------------------------------------------
// Follow-ups / Tasks
// -----------------------------------------------------------------
export async function getFollowups(ctx: CrmCtx, args: { days_without_contact?: number; limit?: number } = {}): Promise<CrmEnvelope> {
  const days = args.days_without_contact ?? 30;
  const limit = Math.min(args.limit ?? 25, 200);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await ctx.supabase
    .from("clients")
    .select("id,name,company_name,email,phone,last_interaction_at")
    .or(`last_interaction_at.lt.${cutoff},last_interaction_at.is.null`)
    .order("last_interaction_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) return errEnv("followups", error.message);
  return okEnv("followups", {
    columns: ["company_name", "name", "phone", "last_interaction_at"],
    rows: data ?? [],
    count: data?.length ?? 0,
  });
}

export async function getTasks(ctx: CrmCtx, args: { status?: string; overdue_only?: boolean; limit?: number } = {}): Promise<CrmEnvelope> {
  const limit = Math.min(args.limit ?? 25, 200);
  let q = ctx.supabase
    .from("tasks")
    .select("id,title,description,status,priority,due_date,client_id,user_id,created_at")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (args.status) q = q.eq("status", args.status);
  if (args.overdue_only) q = q.lt("due_date", new Date().toISOString()).neq("status", "done");
  const { data, error } = await q;
  if (error) return errEnv("tasks", error.message);
  return okEnv("tasks", {
    columns: ["title", "due_date", "status", "priority"],
    rows: data ?? [],
    count: data?.length ?? 0,
  });
}

export async function getContracts(ctx: CrmCtx, args: { status?: string; limit?: number } = {}): Promise<CrmEnvelope> {
  const limit = Math.min(args.limit ?? 25, 200);
  let q = ctx.supabase
    .from("generated_contracts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (args.status) q = q.eq("status", args.status);
  const { data, error } = await q;
  if (error) return errEnv("contracts", error.message);
  return okEnv("contracts", { rows: data ?? [], count: data?.length ?? 0 });
}

// -----------------------------------------------------------------
// Tool Registry — single source used by MCP AND assistant-commercial
// -----------------------------------------------------------------
export type ToolDef = {
  name: string;
  description: string;
  parameters: any; // JSON schema
  handler: (ctx: CrmCtx, args: any) => Promise<CrmEnvelope>;
  readOnly: true;
  aliases?: string[];
};

export const TOOL_REGISTRY: Record<string, ToolDef> = {
  list_clients: {
    name: "list_clients",
    description: "Lista clientes da carteira do usuário. Use scope='team' apenas se admin/gestor pedir a equipe inteira.",
    parameters: { type: "object", properties: { search: { type: "string" }, limit: { type: "number" }, scope: { type: "string", enum: ["own", "team"] } } },
    handler: listClients, readOnly: true, aliases: ["get_clients"],
  },
  search_clients: {
    name: "search_clients",
    description: "Busca clientes por nome, empresa, e-mail, telefone, cidade, CPF ou CNPJ.",
    parameters: { type: "object", required: ["query"], properties: { query: { type: "string" }, limit: { type: "number" } } },
    handler: searchClients, readOnly: true,
  },
  get_customer_history: {
    name: "get_customer_history",
    description: "Histórico completo de um cliente (orçamentos, contratos, financeiro).",
    parameters: { type: "object", properties: { client_id: { type: "string" }, client_name: { type: "string" } } },
    handler: getCustomerHistory, readOnly: true,
  },
  search_products: {
    name: "search_products",
    description: "Busca produtos por nome, código, SKU, marca, descrição ou categoria.",
    parameters: { type: "object", properties: { query: { type: "string" }, brand: { type: "string" }, category: { type: "string" }, limit: { type: "number" } } },
    handler: searchProducts, readOnly: true, aliases: ["get_products", "list_products"],
  },
  get_product_details: {
    name: "get_product_details",
    description: "Retorna todos os dados do produto MCI pelo id.",
    parameters: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    handler: getProductDetails, readOnly: true,
  },
  list_quotes: {
    name: "list_quotes",
    description: "Lista orçamentos da carteira do usuário. Aceita filtro por status.",
    parameters: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" }, scope: { type: "string", enum: ["own", "team"] } } },
    handler: listQuotes, readOnly: true, aliases: ["get_quotes"],
  },
  search_quotes: {
    name: "search_quotes",
    description: "Busca orçamentos por cliente, status, período (from/to ISO).",
    parameters: { type: "object", properties: { client_name: { type: "string" }, status: { type: "string" }, from: { type: "string" }, to: { type: "string" }, limit: { type: "number" }, scope: { type: "string", enum: ["own", "team"] } } },
    handler: searchQuotes, readOnly: true,
  },
  get_pipeline: {
    name: "get_pipeline",
    description: "Orçamentos abertos agrupados por estágio do pipeline.",
    parameters: { type: "object", properties: { scope: { type: "string", enum: ["own", "team"] } } },
    handler: getPipeline, readOnly: true,
  },
  get_dashboard: {
    name: "get_dashboard",
    description: "Dashboard executivo: totais de clientes, orçamentos por status, valor previsto.",
    parameters: { type: "object", properties: {} },
    handler: getDashboard, readOnly: true,
  },
  get_sales_metrics: {
    name: "get_sales_metrics",
    description: "Métricas de vendas (orçamentos aprovados): receita total, ticket médio. Aceita from/to ou days_back.",
    parameters: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, days_back: { type: "number" }, scope: { type: "string", enum: ["own", "team"] } } },
    handler: getSalesMetrics, readOnly: true, aliases: ["get_metrics"],
  },
  get_top_products: {
    name: "get_top_products",
    description: "Ranking de produtos mais vendidos (apenas orçamentos aprovados). metric='quantity' ou 'revenue'.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string" }, to: { type: "string" }, days_back: { type: "number" },
        metric: { type: "string", enum: ["quantity", "revenue"] },
        brand: { type: "string" }, limit: { type: "number" },
        scope: { type: "string", enum: ["own", "team"] },
      },
    },
    handler: getTopProducts, readOnly: true,
  },
  get_followups: {
    name: "get_followups",
    description: "Clientes sem interação recente (default 30 dias) para follow-up.",
    parameters: { type: "object", properties: { days_without_contact: { type: "number" }, limit: { type: "number" } } },
    handler: getFollowups, readOnly: true,
  },
  get_tasks: {
    name: "get_tasks",
    description: "Lista tarefas do usuário. overdue_only=true traz apenas vencidas não concluídas.",
    parameters: { type: "object", properties: { status: { type: "string" }, overdue_only: { type: "boolean" }, limit: { type: "number" } } },
    handler: getTasks, readOnly: true,
  },
  get_contracts: {
    name: "get_contracts",
    description: "Lista contratos gerados e status de assinatura.",
    parameters: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } } },
    handler: getContracts, readOnly: true,
  },
};

// Resolve name or alias to a tool
export function resolveTool(name: string): ToolDef | null {
  if (TOOL_REGISTRY[name]) return TOOL_REGISTRY[name];
  for (const t of Object.values(TOOL_REGISTRY)) {
    if (t.aliases?.includes(name)) return t;
  }
  return null;
}

// OpenAI-format tool schemas (usable directly by chat completions endpoints)
export function openAiToolSchemas(): any[] {
  return Object.values(TOOL_REGISTRY).map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}
