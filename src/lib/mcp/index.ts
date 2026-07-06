import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClientsTool from "./tools/list-clients";
import listQuotesTool from "./tools/list-quotes";
import whoamiTool from "./tools/whoami";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mci-crm-mcp",
  title: "MCI CRM MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas do MCI CRM. Use `whoami` para checar a sessão, `list_clients` para consultar clientes e `list_quotes` para consultar orçamentos do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listClientsTool, listQuotesTool],
});
