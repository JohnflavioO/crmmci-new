# CRM MCI: ARCHITECTURE_BASELINE

Este documento define o estado estável da arquitetura do CRM MCI após as otimizações de performance, segurança e escalabilidade realizadas em Agosto de 2026. Serve como referência para auditorias e impede regressões técnicas.

---

## 1. Arquitetura de Cache (React Query)

O sistema utiliza `staleTime` granular para equilibrar a carga no banco de dados e a necessidade de dados em tempo real.

### Políticas de Cache por Módulo:
| Módulo | staleTime | Justificativa |
| :--- | :--- | :--- |
| **Produtos / Catálogo** | 15 min | Mudanças de SKU/Preço são menos frequentes. |
| **Clientes** | 10 min | Carteira de clientes estável; evita refetchs em navegação rápida. |
| **Configurações / Tema** | 30 min | Dados raramente alterados durante a sessão. |
| **Métricas / KPIs** | 5 min | Dashboards exigem frescor, mas não tempo real absoluto. |
| **Orçamentos (Lista)** | 2 min | Lista de alta rotatividade. |
| **Detalhes do Orçamento** | 0 ms | Sempre garantir a última versão ao editar. |

**Regra Crítica:** NUNCA remover o `queryKey` que inclua `period` ou `scope` em `useCommercialSummary` ou `useClientRanking`, sob risco de poluir o cache com dados de escopos diferentes.

---

## 2. Handlers Compartilhados (CRM Handlers)

Localizados em `supabase/functions/_shared/crm-handlers.ts`, estes handlers são a **única fonte de verdade** para lógica comercial.

- **Uso Unificado:** Consumidos por Edge Functions (Assistant, Intelligence) e pelo MCP Server.
- **Vantagem:** Alterações em regras de comissão ou cálculo de receita são feitas em um único lugar.
- **Contexto (`CrmCtx`):** Exige injeção de `supabase` (scoped client), `userId` e `companyId`.

---

## 3. Segurança e Escopo de Dados

### Regras de `company_id`
- **Isolamento Total:** Todas as consultas comerciais DEVEM passar pelo helper `scopeCompany(query, ctx)`.
- **Prevenção de Leaks:** O RLS (Row Level Security) está habilitado em todas as tabelas (`public.quotes`, `public.clients`, etc.), mas a filtragem explícita no código é obrigatória para performance e clareza.

### Hierarquia de Acesso (Escopo)
- **Vendedor:** Vê apenas seus próprios registros (`created_by` ou `salesperson_id`).
- **Gestor / Equipe:** Pode ampliar o escopo para `team` (ver dados da empresa inteira).
- **Admin:** Acesso total via `user_roles`.
- **RPC `get_current_user_access`:** Única via de entrada para hidratar o `useAuth` com permissões JSONB e cargos reais.

---

## 4. Banco de Dados e RPCs Críticas

### RPCs Mandatórias:
- `get_current_user_access`: Carrega perfil + roles + permissões em um único request.
- `get_commercial_summary`: Agregação SQL nativa para o Dashboard (substituiu processamento em JS).
- `rankProductMatch`: Busca fonética/textual otimizada para produtos em orçamentos.

---

## 5. Edge Functions

O CRM MCI utiliza Edge Functions para tarefas pesadas ou que exigem segredos (como IA):
- `assistant-commercial`: Processamento de linguagem natural (Gemini-3-Flash).
- `receive-reseller-registration`: Ponto de entrada público com rate-limit e validação de CNPJ.
- `lookup-cnpj-public`: Cache de dados da Receita Federal para novos cadastros.

---

## 6. Realtime (Supabase Realtime)

O uso de Realtime deve ser **seletivo** para evitar consumo excessivo de conexões.
- **Regra:** Aplicar filtros de evento (ex: apenas `INSERT`) e filtros de coluna sempre que possível.
- **Implementação Referência:** `useResellerRegistrations.ts` (escuta apenas novos leads).

---

## 7. Service Workers e Recuperação

- **`browserRecovery.ts`:** Implementa um Kill-Switch para o Service Worker. Se o app detectar inconsistências de cache ou erros de rede persistentes, o SW é removido automaticamente.
- **Não Alterar:** O script de registro em `main.tsx` que inclui a lógica de remoção forçada.

---

## 8. Regras Críticas de Performance

1. **SQL Period Filtering:** NUNCA carregue dados históricos para filtrar no frontend. Use `gte/lte` no SQL via `days_back`.
2. **Column Pruning:** Selecione apenas as colunas necessárias (`.select('id, name')`). Payload JSON > 1MB é considerado erro de arquitetura.
3. **Parallel Chunking:** Use `Promise.all` para buscar itens de múltiplos orçamentos em paralelo quando necessário.

---

## 9. Riscos de Regressão Identificados

- **Cálculo de Impostos:** A lógica de ICMS/ST nos orçamentos é sensível a mudanças na tabela `products`.
- **Validação de Pagamentos:** O trigger `trg_enforce_quote_payment` é rígido; qualquer alteração no frontend que ignore campos de pagamento causará erro 42501 (RLS/Trigger).
- **Impressão de PDF:** O gerador de PDF (`generateTechnicalPdf.ts`) depende de bibliotecas de renderização que podem quebrar se o CSP (Content Security Policy) for alterado.

---

## 10. Componentes "Freeze" (Não alterar sem auditoria)

- `Quotes.tsx`: Lógica complexa de estados e validações fiscais.
- `useAuth.tsx`: Sistema de propagação de permissões críticas.
- `PublicQuote.tsx`: Interface pública com tokens de expiração (Segurança).

---
*Documento gerado automaticamente pelo Lovable Agent - Agosto 2026.*
