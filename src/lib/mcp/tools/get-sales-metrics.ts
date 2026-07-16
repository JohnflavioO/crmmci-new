import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, ok, err } from "../_supabase";

export default defineTool({
  name: "get_sales_metrics",
  title: "Métricas de vendas",
  description: "Retorna métricas de vendas (aprovados) em um período: total, ticket médio, top produtos.",
  inputSchema: {
    from: z.string().optional().describe("Data inicial ISO"),
    to: z.string().optional().describe("Data final ISO"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    const guard = requireAuth(ctx); if (guard) return guard;
    const sb = supabaseForUser(ctx);
    let q = sb.from("quotes").select("id,status,total,client_name,created_at").eq("status", "aprovado").limit(2000);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    const { data, error } = await q;
    if (error) return err(error.message);
    const total = (data ?? []).reduce((s, r: any) => s + Number(r.total ?? 0), 0);
    const count = data?.length ?? 0;
    return ok({
      approved_count: count,
      revenue_total: total,
      average_ticket: count ? total / count : 0,
      period: { from: from ?? null, to: to ?? null },
    }, "metrics");
  },
});
