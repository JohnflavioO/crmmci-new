
# Integração Suporte Técnico ↔ Cadastro único de Clientes

Objetivo: usar um único cadastro de clientes (tabela `clients`) como fonte da verdade, mantendo `technical_clients` sincronizada, sem quebrar o Suporte existente. Introduzir o campo `salesperson_id` como vendedor da carteira, criar o fluxo "Transferir para Comercial" e um Histórico 360 compartilhado.

## 1. Banco de dados (migração única)

**Novo campo de carteira em `clients`:**
- `salesperson_id uuid` — vendedor responsável pela carteira (nullable = sem carteira).
- Índice em `salesperson_id`.
- Backfill: `UPDATE clients SET salesperson_id = created_by WHERE salesperson_id IS NULL` para preservar comportamento atual.

**Vínculo entre as duas tabelas de cliente:**
- Nova coluna em `technical_clients`: `crm_client_id uuid REFERENCES clients(id)`.
- Índice em `crm_client_id`.

**Sincronização automática (triggers):**
- Trigger `AFTER INSERT` em `technical_clients`: se `crm_client_id` for nulo, tenta casar por `cpf_cnpj` em `clients`; se não achar, cria um novo `clients` (com `created_by = current user`, `salesperson_id = NULL` porque suporte não define carteira) e grava o id em `crm_client_id`.
- Trigger `AFTER UPDATE` em `technical_clients`: propaga alterações de contato (email/phone/whatsapp/endereço) para o `clients` vinculado — sem tocar em `salesperson_id` nem `created_by`.
- Não fazemos o caminho inverso (clients → technical_clients) para não poluir o Suporte com clientes que nunca abriram chamado.

**Regra de proteção da carteira:**
- Trigger `BEFORE UPDATE` em `clients`: se `salesperson_id` mudou e o usuário não é `is_admin()` nem `is_gestor()`, reverte para o valor antigo (silencioso). Isso garante que Suporte, Financeiro, Logística e o próprio vendedor não consigam alterar a carteira.

**RLS ajustada em `clients`:**
- Manter policies existentes de `created_by`.
- Adicionar policy adicional de SELECT/UPDATE limitada a campos por: `salesperson_id = auth.uid()` — para que o vendedor da carteira enxergue e edite (exceto o próprio campo, protegido pelo trigger acima).
- Adicionar policy SELECT para `is_support_any()`: suporte pode ler o cadastro do cliente (para exibir Histórico 360 e permitir busca ao abrir chamado), sem poder alterar carteira.
- Manter policy de admin/gestor com acesso total.

**Nova tabela `client_timeline` (opcional, view materializada leve):**
- Em vez de tabela nova, o Histórico 360 vai ser montado via queries paralelas no frontend (mais simples e sempre atualizado). Nada a criar no banco aqui.

## 2. Fluxo "Transferir para Comercial"

Novo botão na tela de detalhe da OS de Suporte (`SupportOrderDetail.tsx`):

1. Resolve o `clients.id` a partir de `technical_orders.client_id` → `technical_clients.crm_client_id` (cria on-the-fly se ainda não existir, via a trigger).
2. Lê `clients.salesperson_id`:
   - Se preenchido → `owner = salesperson_id`.
   - Se nulo → `owner = NULL` (fica na Central Operacional / distribuição padrão).
3. Cria em uma transação:
   - `smart_opportunities`: `cliente_id`, `vendedor_id = owner`, `tipo_oportunidade = 'Suporte→Comercial'`, `motivo` com o número da OS e resumo do defeito relatado, `prioridade = 'média'`, `status = 'Nova'`.
   - `quotes`: `status = 'draft'`, `client_id`, `created_by = owner` (ou `auth.uid()` do suporte se `owner` nulo), `client_name` preenchido, `notes` com link/ref para a OS.
   - `notifications` (só se `owner` não nulo): notifica o vendedor com título "Nova oportunidade vinda do Suporte — OS <número>".
4. Marca a OS com `handoff_quote_id` (novo campo `uuid` em `technical_orders`) para evitar duplicação e mostrar o link do orçamento gerado.

O suporte nunca escreve em `clients.salesperson_id`.

## 3. Cadastro de cliente pelo Suporte

Em `SupportClients.tsx` e no seletor de cliente ao abrir OS:

- Substituir o input simples por um **combobox de busca** que consulta `clients` (por nome, cpf/cnpj, email) — mostra vendedor da carteira ao lado do resultado.
- Se o usuário escolher um cliente existente: cria (ou reaproveita) `technical_clients` já com `crm_client_id` preenchido.
- Se clicar em "Cadastrar novo": abre o wizard atual, mas ao salvar a trigger cria o `clients` correspondente automaticamente. O suporte não vê nem define `salesperson_id`.

## 4. Histórico 360 (aba única, reaproveitada)

Novo componente `src/components/clients/ClientHistory360.tsx` — usado nos dois módulos:

- **Cabeçalho**: dados cadastrais + badge com vendedor da carteira + origem (Suporte/Comercial).
- **Abas internas**:
  - Orçamentos (`quotes` por `client_id`)
  - Compras/Faturados (`quotes` status Aprovado/Entregue/Faturado)
  - Inteligência Comercial (`smart_opportunities`)
  - Chamados (`technical_orders` via `technical_clients.crm_client_id`)
  - Equipamentos (`technical_clients.equipments` + equipamentos das OS)
  - Manutenções (`technical_maintenances`)
  - Anexos & Observações
  - Linha do tempo consolidada (merge cronológico dos eventos acima)

Cada query respeita a RLS existente, então cada perfil vê só o que pode.

Pontos de uso:
- Comercial: nova aba "Histórico 360" em `src/pages/Clients.tsx` (drawer/modal ao abrir o cliente).
- Suporte: mesmo componente na tela de detalhe do cliente / detalhe da OS.

## 5. Permissões e RLS — resumo

| Ação | Suporte | Vendedor dono | Vendedor não-dono | Gestor / Admin |
|---|---|---|---|---|
| Buscar/ver dados básicos do cliente | Sim | Sim | Não | Sim |
| Editar dados de contato do cliente | Sim (via technical_clients, sync) | Sim | Não | Sim |
| Alterar `salesperson_id` (carteira) | **Não** (bloqueio por trigger) | **Não** | Não | Sim |
| Criar cliente novo | Sim (sem carteira) | Sim (fica dono) | — | Sim |
| Transferir OS → Comercial | Sim | — | — | Sim |
| Ver Histórico 360 | Sim (limitado por RLS) | Sim | Não | Sim |

## 6. Arquivos afetados

**Backend (uma migração):**
- `supabase/migrations/…_integrate_support_clients.sql` — colunas novas, backfill, triggers, RLS.

**Frontend:**
- `src/pages/support/SupportClients.tsx` — combobox de busca em `clients`.
- `src/pages/support/SupportOrders.tsx` / `SupportOrderDetail.tsx` — seletor de cliente unificado + botão "Transferir para Comercial".
- `src/components/clients/ClientHistory360.tsx` — novo.
- `src/pages/Clients.tsx` — aba/drawer "Histórico 360".
- `src/components/UserPermissionsEditor.tsx` — nada obrigatório (permissões seguem RLS).
- Tipos regenerados automaticamente pós-migração.

## 7. Não incluído

- Não migro dados existentes de `technical_clients` para `clients` de forma retroativa (você escolheu "só na criação"); apenas conforme os registros forem tocados, a trigger cria/vincula.
- Não crio nova tabela de timeline — Histórico 360 é query-time.
- Não altero regras de distribuição de leads existentes quando o cliente não tem carteira: mantenho a oportunidade "sem vendedor" na Central Operacional, como já ocorre.
