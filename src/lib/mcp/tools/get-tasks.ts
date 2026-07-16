import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, ok, err } from "../_supabase";

export default defineTool({
  name: "get_tasks",
  title: "Listar tarefas",
  description: "Lista tarefas do usuário autenticado, com filtro opcional de status.",
  inputSchema: {
    status: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    const guard = requireAuth(ctx); if (guard) return guard;
    let q = supabaseForUser(ctx)
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return err(error.message);
    return ok(data, "tasks");
  },
});
