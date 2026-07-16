import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, ok, err } from "../_supabase";

export default defineTool({
  name: "get_followups",
  title: "Follow-ups pendentes",
  description: "Retorna clientes sem interação recente (default: 30 dias) para follow-up.",
  inputSchema: {
    days_without_contact: z.number().int().min(1).max(365).default(30),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days_without_contact, limit }, ctx) => {
    const guard = requireAuth(ctx); if (guard) return guard;
    const cutoff = new Date(Date.now() - days_without_contact * 86400_000).toISOString();
    const { data, error } = await supabaseForUser(ctx)
      .from("clients")
      .select("id,name,email,phone,last_contact_at,updated_at,created_at")
      .or(`last_contact_at.lt.${cutoff},last_contact_at.is.null`)
      .order("last_contact_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (error) return err(error.message);
    return ok(data, "followups");
  },
});
