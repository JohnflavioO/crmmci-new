import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, ok, err } from "../_supabase";

export default defineTool({
  name: "search_clients",
  title: "Buscar clientes",
  description: "Busca clientes por nome, email, telefone, cidade, CNPJ ou CPF respeitando permissões (RLS).",
  inputSchema: {
    query: z.string().min(1).describe("Termo de busca"),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    const guard = requireAuth(ctx); if (guard) return guard;
    const like = `%${query}%`;
    const { data, error } = await supabaseForUser(ctx)
      .from("clients")
      .select("id,name,email,phone,city,state,cnpj,cpf,created_at")
      .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like},city.ilike.${like},cnpj.ilike.${like},cpf.ilike.${like}`)
      .limit(limit);
    if (error) return err(error.message);
    return ok(data, "clients");
  },
});
