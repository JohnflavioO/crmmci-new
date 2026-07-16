import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, requireAuth, ok, err } from "../_supabase";

export default defineTool({
  name: "get_pipeline",
  title: "Pipeline comercial",
  description: "Retorna orçamentos agrupados por status para visualização de pipeline.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const guard = requireAuth(ctx); if (guard) return guard;
    const { data, error } = await supabaseForUser(ctx)
      .from("quotes")
      .select("id,client_name,status,total,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return err(error.message);
    const byStatus: Record<string, { count: number; total: number; items: any[] }> = {};
    for (const q of data ?? []) {
      const s = (q as any).status ?? "sem_status";
      byStatus[s] ??= { count: 0, total: 0, items: [] };
      byStatus[s].count += 1;
      byStatus[s].total += Number((q as any).total ?? 0);
      if (byStatus[s].items.length < 20) byStatus[s].items.push(q);
    }
    return ok(byStatus, "pipeline");
  },
});
