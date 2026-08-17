# Plano de Migração - Fase 3 (Item 1): Métricas do Dashboard

Migração das consultas comerciais do Dashboard para handlers centralizados via Edge Functions, unificando a lógica entre Frontend e IA.

## Mudanças Propostas

### Frontend
- Criar hook `useDashboardHandlers.ts` para encapsular chamadas às Edge Functions `crm-tools`.
- Migrar `Dashboard.tsx`:
  - Substituir `supabase.from('quotes')` manual por `getSalesMetrics` (para métricas de vendas).
  - Substituir cálculos manuais de pipeline por `getPipeline`.
  - Manter `useCommercialSummary` (RPC) para KPIs básicos de topo de tela (Total Clientes, Produtos).
  - Garantir que filtros de "Time" (Gestor) e "Individual" (Vendedor) usem o parâmetro `scope` corretamente.

### Backend (Edge Functions)
- Utilizar `getSalesMetrics` e `getPipeline` já existentes em `crm-handlers.ts`.
- Validar se o `scopeOwn` no backend respeita as mesmas regras de visibilidade do frontend.

## Detalhes Técnicos
- O cache será gerenciado pelo React Query (staleTime: 5m).
- Redução de volume de dados: O frontend deixará de baixar centenas de linhas de orçamentos para calcular totais, recebendo apenas o JSON agregado.

## Validação
- Comparação de valores de Receita Aprovada e Ticket Médio entre o hook antigo e o novo.
- Teste de perfil: Vendedor deve ver apenas sua carteira; Gestor deve poder alternar entre equipe e individual.
- Inspeção da aba Network para confirmar que o `supabase.from('quotes').select(...)` massivo foi removido.
