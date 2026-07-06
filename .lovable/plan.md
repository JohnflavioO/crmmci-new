
# Copiloto Comercial MCI — Fase 1

Escopo aprovado: consultas de todos os módulos + ações em Clientes, Orçamentos, Pipeline/Tarefas/Follow-ups. Confirmação por card de prévia. Sugestões inteligentes no painel. Auditoria em tabela dedicada `assistant_audit_log`.

Nada existente será alterado — apenas evoluímos o módulo Assistente Comercial.

## 1. Banco de dados

Nova migration criando:

**`assistant_audit_log`** — campos exatamente como definidos pelo usuário:
`id, company_id, user_id, conversation_id, action_type, tool_name, module, entity_type, entity_id, prompt, tool_input(jsonb), tool_output(jsonb), confirmation_required(bool), confirmation_result(text: confirmed|cancelled|expired|null), execution_status(text: preview|waiting_confirmation|executed|cancelled|failed), execution_time_ms(int), model, provider, prompt_tokens, completion_tokens, total_tokens, estimated_cost(numeric), ip, user_agent, created_at`

RLS:
- Usuário lê os próprios registros.
- Admin/Gestor lê tudo da empresa.
- INSERT apenas via edge function (service_role).

GRANTs para authenticated (SELECT) e service_role (ALL). Índices em `(company_id, created_at desc)`, `(user_id, created_at desc)`, `(action_type)`, `(execution_status)`.

## 2. Edge function `assistant-commercial` — evolução

Mantém hybrid mode (SQL fast path + GPT) e histórico. Adiciona:

**Registry de tools** dividido em `read_tools` e `write_tools`. Cada tool declara:
- `name`, `module`, `entity_type`
- `requiresConfirmation: boolean`
- `permissionKey` (mapeado ao usePermissions do CRM)
- `execute(ctx, input)` que chama Supabase com auth do usuário (RLS)

**Read tools (executam direto):**
- Clientes: `consultar_clientes`, `buscar_cliente`, `mostrar_historico_cliente`
- Orçamentos: `consultar_orcamentos`
- Produtos: `consultar_produtos`, `buscar_produto`, `consultar_estoque`, `consultar_preco`
- Pipeline: `consultar_pipeline`
- Financeiro: `consultar_pagamentos`, `consultar_faturamento`, `consultar_recebimentos`
- Logística: `consultar_pedido`, `consultar_nf`, `consultar_rastreio`
- BI: `ranking_vendedores`, `clientes_sem_comprar`, `previsao_faturamento`, `clientes_por_estado`, `conversao`, `ticket_medio`

**Write tools (fluxo preview → confirm):**
- Clientes: `criar_cliente`, `editar_cliente`, `transferir_carteira`
- Orçamentos: `criar_orcamento`, `duplicar_orcamento`, `editar_orcamento`, `cancelar_orcamento`, `aprovar_orcamento`, `gerar_pdf`, `gerar_contrato`, `enviar_por_email`
- Pipeline: `mover_pipeline`, `criar_followup`, `agendar_retorno`
- Tarefas: `criar_tarefa`, `editar_tarefa`, `atribuir_tarefa`

**Fluxo de write tools:**
1. Modelo chama a tool → função monta payload e **não grava**.
2. Retorna `{ preview: true, action_id (uuid), action_type, summary, payload }`.
3. Grava row em `assistant_audit_log` com `execution_status='waiting_confirmation'`.
4. UI mostra card de prévia com botões Confirmar/Cancelar.
5. Nova rota `POST /confirm` com `{ action_id, decision }`:
   - Recarrega row, valida owner + permissão + expiração (10 min).
   - Executa a mutação, atualiza row para `executed`/`cancelled`/`failed`, retorna resultado.

**Contexto automático** enviado em cada request: `user_id, company_id, role, permissions, current_route, current_client_id, current_quote_id`. Adicionado ao system prompt + disponível para tools.

**Verificação de permissão** por tool usando `permissionKey` (espelho do `usePermissions`). Se negada, tool retorna erro estruturado antes de qualquer gravação.

**Auditoria**: só write tools geram row. Read tools continuam apenas em `assistant_messages`.

## 3. Frontend — `src/pages/AssistenteComercial.tsx`

Mantém shell atual (AppLayout, histórico lateral, hybrid mode). Adiciona:

**Painel de insights automáticos (topo):**
Cards clicáveis alimentados por queries reais ao Supabase (client-side, um `useEffect` paralelo):
- Follow-ups vencidos hoje
- Propostas > R$50k sem update há 10+ dias
- Clientes 180+ dias sem comprar
- Demonstrações vencendo em 7 dias
- Vendedor top do mês
- Oportunidades sem responsável

Clique dispara um prompt pré-formatado no assistente.

**Ações rápidas** (chips): "Meus orçamentos", "Ranking do mês", "Follow-ups de hoje", "Criar orçamento", "Novo cliente".

**Renderização de tool results:**
Novo componente `ToolResultRenderer` que reconhece o `type` do output:
- `table` → shadcn Table com export CSV
- `kpi` → grid de StatCards
- `client_card`, `quote_card`, `product_list`, `timeline`
- `preview_action` → card destacado com resumo + botões Confirmar (chama `/confirm`) / Cancelar / Editar

**Contexto** enviado a cada request lido de `useLocation()` + `useAuth()` + IDs da rota atual.

## 4. Nova página `Auditoria do Assistente` (admin)

Rota `/assistente/auditoria` em `App.tsx`, gated por `isAdmin || isGestor`. Item no sidebar dentro do grupo do assistente.

Conteúdo:
- KPIs do dia: ações executadas, canceladas, com erro, tokens totais, custo estimado, tempo médio
- Filtros: período, vendedor, ferramenta, status, módulo
- Tabela paginada com todos os campos + drawer de detalhes (prompt, input, output, timing)
- Gráficos leves: ferramentas mais usadas, ações por vendedor, custo por dia (Recharts, já no projeto)

## 5. Segurança

- Todas as tools passam pelo cliente Supabase autenticado com o JWT do usuário → RLS existente aplica-se automaticamente.
- `permissionKey` bloqueia tools antes mesmo da chamada.
- Rota `/confirm` re-valida `user_id` do row de auditoria vs `auth.uid()`.
- IP + user_agent extraídos dos headers da request.

## 6. Arquivos afetados

**Novos:**
- `supabase/migrations/<timestamp>_assistant_audit_log.sql`
- `supabase/functions/assistant-commercial/tools/` (read.ts, write.ts, registry.ts)
- `src/components/assistant/ToolResultRenderer.tsx`
- `src/components/assistant/InsightsPanel.tsx`
- `src/components/assistant/PreviewActionCard.tsx`
- `src/pages/AssistantAudit.tsx`

**Editados:**
- `supabase/functions/assistant-commercial/index.ts` (registry + confirm endpoint + contexto + auditoria)
- `src/pages/AssistenteComercial.tsx` (insights, ações rápidas, contexto, renderer)
- `src/App.tsx` (rota /assistente/auditoria)
- `src/components/AppSidebar.tsx` (item de auditoria para admin/gestor)

## Fora do escopo (fica para depois)

- Tools de suporte técnico (OS)
- Envio real de email/PDF por integração externa nova (usa apenas o que já existe)
- Streaming de tokens no chat (mantém request/response atual)
- Expiração automática de previews via cron (validamos on-demand)

Aprova para eu implementar?
