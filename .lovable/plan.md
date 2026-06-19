# Auditoria do Módulo Suporte Técnico

Mapeei as 10 páginas + componentes e levantei bugs reais (consultas quebradas, botões sem ação, dados mockados). Abaixo o que está quebrado e o que vou corrigir numa única leva.

## Bugs identificados

| # | Página | Problema |
|---|---|---|
| 1 | NewPurchaseOrderDialog / SupportPurchases | Faz `select('document')` em `technical_clients` — coluna não existe (é `cpf_cnpj`). Cliente aparece "—" no detalhe. |
| 2 | SupportPurchases | Botão **Filtrar** sem ação. Sem filtro por status. |
| 3 | SupportPurchases | Venda **não baixa estoque** ao salvar. Exclusão não estorna. |
| 4 | SupportBudgets | Botão **Novo Orçamento** não abre nada. Botões Editar / PDF / WhatsApp só fazem `toast.info`. |
| 5 | SupportCloud | Botão **Upload** não funciona. Excluir só mostra o item, não deleta. |
| 6 | SupportReports | 100% dos números são `0` mockados (constantes hardcoded). Filtros sem efeito. |
| 7 | SupportClients | Reset do form após salvar não limpa `city`, `state`, `zip_code`. Editar reaproveita objeto cru do banco (campos extras vão pro update). |
| 8 | SupportOrders | Formulário "Nova OS" não tem campo **equipamento**, só modelo/serial → coluna fica vazia. Ação WhatsApp lê `o.clients?.phone` (relação não carregada) — sempre falha. |
| 9 | SupportOrderDetail | Não tem como **adicionar peças usadas** na OS. `parts_value` é digitado à mão sem vínculo com estoque. |
| 10 | SupportStock | Botão "Cadastrar Marca" mantém o dialog antigo, mas falta validação de duplicidade. (menor) |

## Correções nesta entrega

### Migração (DB)
- **Tabela `technical_order_parts`** (peças usadas em cada OS) + trigger:
  - INSERT/UPDATE → debita `technical_products.quantity`
  - DELETE → estorna
  - Trigger também recalcula `parts_value` e `total_value` da OS automaticamente.
- **Trigger em `technical_purchase_order_items`** (vendas): debita estoque no INSERT, estorna no DELETE.
- **Bucket de storage `technical-cloud`** (privado) + policies para suporte fazer upload/leitura/delete.
- GRANTs e RLS já cobertos por `is_support_any()`.

### Frontend (parallel edits)
1. **NewPurchaseOrderDialog** + **SupportPurchases**: trocar `document` → `cpf_cnpj` em todos os selects/exibições. Adicionar filtro por status no header de Compras.
2. **SupportBudgets**: criar `NewBudgetDialog` (escolher OS → carregar cliente → digitar serviços/peças/desconto → salvar em `technical_budgets`). Editar abre o mesmo dialog em modo edição. Botão WhatsApp envia link/resumo. PDF: gerar via window.print de uma rota dedicada (simples).
3. **SupportCloud**: implementar upload real (input file → `storage.upload` no bucket → insert em `technical_cloud_files`). Delete real (storage.remove + delete row). Categoria via Select (Manual / Firmware / Esquema / Outros).
4. **SupportReports**: substituir todos os mocks por queries reais:
   - Produtividade por técnico (count de OS por `technician_name`)
   - Status das OS (counts reais)
   - Falhas recorrentes (top `reported_defect`)
   - Equipamentos mais manutenidos (top `equipment`)
   - Produtos mais utilizados (top `technical_order_parts` por produto)
   - OS por categoria (`os_type`)
   - Filtros por técnico e intervalo de datas funcionando.
5. **SupportClients**: reset completo dos campos; ao editar, passar só os campos editáveis.
6. **SupportOrders**: adicionar input "Equipamento" no Nova OS; corrigir lookup de telefone do WhatsApp (carregar `technical_clients(phone, whatsapp)` no select).
7. **SupportOrderDetail**: nova seção **Peças Utilizadas** — buscar peça do estoque, definir qty e preço unitário, adicionar/remover. Trigger faz a baixa e atualiza `parts_value`/`total_value` sozinho.

## Não escopo nesta entrega
- Integração com Financeiro principal (você optou por manter isolado).
- Geração de PDF estilizado de orçamento (uso `window.print` simples).
- Redesign visual — só correção funcional.

## Detalhes técnicos
- O trigger de peças usa `OLD/NEW` e ajusta o produto correspondente; em UPDATE de `quantity` ou `product_id` faz o delta correto.
- `technical_order_parts` herda RLS de `is_support_any()`.
- Recalc da OS é feito em `AFTER` trigger para não brigar com a regra de `total_value` já gravada no detail.
- Cloud bucket = privado; URLs geradas via `createSignedUrl` 1h ao listar (ou public read se preferir — pergunto se isso bloquear você).
