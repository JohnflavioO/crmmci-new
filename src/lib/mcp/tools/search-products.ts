import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, ok, err } from "../_supabase";

export default defineTool({
  name: "search_products",
  title: "Buscar produtos",
  description: "Busca textual no catálogo MCI por nome, SKU, marca ou descrição.",
  inputSchema: {
    query: z.string().min(1).describe("Termo de busca"),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    const guard = requireAuth(ctx); if (guard) return guard;
    const like = `%${query}%`;
    const { data, error } = await supabaseForUser(ctx)
      .from("products")
      .select("id,name,sku,brand,category,price,stock")
      .or(`name.ilike.${like},sku.ilike.${like},brand.ilike.${like},description.ilike.${like}`)
      .limit(limit);
    if (error) return err(error.message);
    return ok(data, "products");
  },
});
