import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, ok, err } from "../_supabase";

export default defineTool({
  name: "get_products",
  title: "Listar produtos",
  description: "Lista produtos do catálogo MCI visíveis ao usuário autenticado.",
  inputSchema: {
    search: z.string().optional().describe("Filtro por nome/SKU/marca"),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    const guard = requireAuth(ctx); if (guard) return guard;
    let q = supabaseForUser(ctx)
      .from("products")
      .select("id,name,sku,brand,category,price,stock,created_at")
      .order("name", { ascending: true })
      .limit(limit);
    if (search) {
      const like = `%${search}%`;
      q = q.or(`name.ilike.${like},sku.ilike.${like},brand.ilike.${like}`);
    }
    const { data, error } = await q;
    if (error) return err(error.message);
    return ok(data, "products");
  },
});
