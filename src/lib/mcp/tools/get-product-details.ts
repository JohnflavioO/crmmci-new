import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, ok, err } from "../_supabase";

export default defineTool({
  name: "get_product_details",
  title: "Detalhes do produto",
  description:
    "Retorna os dados completos de um produto do catálogo MCI (nome, marca, categoria, descrição, preço, especificações e notas de compatibilidade). Somente leitura.",
  inputSchema: {
    id: z.string().uuid().describe("UUID do produto MCI"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const guard = requireAuth(ctx); if (guard) return guard;
    const { data, error } = await supabaseForUser(ctx)
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return err(error.message);
    if (!data) return err("Produto não encontrado");
    return ok(data, "product");
  },
});
