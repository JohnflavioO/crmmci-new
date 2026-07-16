import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, ok, err } from "../_supabase";

export default defineTool({
  name: "search_quotes",
  title: "Buscar orçamentos",
  description: "Busca orçamentos por cliente, status ou intervalo de datas.",
  inputSchema: {
    client_name: z.string().optional(),
    status: z.string().optional(),
    from: z.string().optional().describe("Data inicial ISO (created_at >=)"),
    to: z.string().optional().describe("Data final ISO (created_at <=)"),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ client_name, status, from, to, limit }, ctx) => {
    const guard = requireAuth(ctx); if (guard) return guard;
    let q = supabaseForUser(ctx)
      .from("quotes")
      .select("id,client_name,status,total,created_at,valid_until")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (client_name) q = q.ilike("client_name", `%${client_name}%`);
    if (status) q = q.eq("status", status);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    const { data, error } = await q;
    if (error) return err(error.message);
    return ok(data, "quotes");
  },
});
