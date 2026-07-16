import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, requireAuth, ok, err } from "../_supabase";

export default defineTool({
  name: "get_dashboard",
  title: "Dashboard comercial",
  description: "Retorna métricas resumidas: totais de clientes, orçamentos por status, valor previsto.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const guard = requireAuth(ctx); if (guard) return guard;
    const sb = supabaseForUser(ctx);
    const [clientsRes, quotesRes] = await Promise.all([
      sb.from("clients").select("id", { count: "exact", head: true }),
      sb.from("quotes").select("status,total,created_at").limit(1000),
    ]);
    if (quotesRes.error) return err(quotesRes.error.message);
    const byStatus: Record<string, { count: number; total: number }> = {};
    let grandTotal = 0;
    for (const q of quotesRes.data ?? []) {
      const s = (q as any).status ?? "sem_status";
      byStatus[s] ??= { count: 0, total: 0 };
      byStatus[s].count += 1;
      byStatus[s].total += Number((q as any).total ?? 0);
      grandTotal += Number((q as any).total ?? 0);
    }
    return ok({
      total_clients: clientsRes.count ?? 0,
      total_quotes: quotesRes.data?.length ?? 0,
      forecast_total: grandTotal,
      quotes_by_status: byStatus,
    }, "dashboard");
  },
});
