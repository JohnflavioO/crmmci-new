import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, ok, err } from "../_supabase";

export default defineTool({
  name: "get_customer_history",
  title: "Histórico do cliente",
  description: "Retorna orçamentos, contratos e financeiro de um cliente (por id ou nome).",
  inputSchema: {
    client_id: z.string().uuid().optional(),
    client_name: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ client_id, client_name }, ctx) => {
    const guard = requireAuth(ctx); if (guard) return guard;
    const sb = supabaseForUser(ctx);
    let client: any = null;
    if (client_id) {
      const { data } = await sb.from("clients").select("*").eq("id", client_id).maybeSingle();
      client = data;
    } else if (client_name) {
      const { data } = await sb.from("clients").select("*").ilike("name", `%${client_name}%`).limit(1).maybeSingle();
      client = data;
    } else {
      return err("Informe client_id ou client_name");
    }
    if (!client) return err("Cliente não encontrado");

    const [quotesRes, contractsRes, finRes] = await Promise.all([
      sb.from("quotes").select("id,status,total,created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(50),
      sb.from("generated_contracts").select("id,status,created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(20),
      sb.from("financial_records").select("id,status,amount,due_date").eq("client_id", client.id).order("due_date", { ascending: false }).limit(50),
    ]);

    return ok({
      client,
      quotes: quotesRes.data ?? [],
      contracts: contractsRes.data ?? [],
      financial: finRes.data ?? [],
    }, "history");
  },
});
