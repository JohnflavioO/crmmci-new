# Plano — Auditoria e correção da sincronização logística

Objetivo: entender exatamente por que cada produto continua sem peso/dimensão após a Sincronização Inteligente e dar ferramentas para resolver caso a caso.

## 1. Backend (edge function `loja-integrada`)

Adicionar novas actions:

- **`audit_missing_dimensions`** — para cada produto CRM vinculado sem peso/dimensão:
  - buscar produto na Loja Integrada por `external_id`
  - inspecionar em ordem: `produto`, `produto_variacao_padrao`, `produto_variacoes[0]`, endpoint `/produto_variacao/<id>`
  - registrar peso/altura/largura/profundidade retornados em cada fonte
  - classificar motivo: `campo_ausente`, `valor_zero`, `valor_null`, `variacao_sem_dimensao`, `sem_vinculo`, `erro_api`, `bloqueado`, `conflito_match`
  - retornar array com { produto CRM, produto LI, ID LI, SKU LI, variação, valores por fonte, fonte usada, motivo }

- **`reprocess_missing_only`** — roda `sync_product_dimensions` apenas nos produtos sem peso OU sem dimensão (não bloqueados).

- **`bulk_similarity_match`** — para produtos "não vinculados":
  - normaliza nome (lowercase, sem acento, sem pontuação)
  - calcula similaridade contra catálogo LI (Jaro-Winkler / Dice)
  - ≥ 0.95 → vincula automaticamente (`linked`)
  - 0.85–0.95 → grava candidatos em `product_external_links.match_candidates` (`needs_validation`)
  - < 0.85 → `not_found`

- Reforço em `sync_product_dimensions`: quando dimensões seguem zeradas após parse do produto e da variação padrão, chamar `/produto_variacao/<id>` explicitamente antes de desistir.

## 2. Tela `LogisticsSyncDiagnostic.tsx`

### Novos indicadores no topo
- **Prontos para frete**: produtos com peso > 0 E altura > 0 E largura > 0 E comprimento > 0.
- Separar contadores: `Vinculado completo`, `Vinculado sem peso`, `Vinculado sem dimensões`, `Aguardando validação`, `Sem correspondência`, `Erro`.

### Novos botões
- **Reprocessar somente sem peso/dimensões** → chama `reprocess_missing_only`.
- **Exportar pendências CSV** → gera CSV client-side com as colunas da auditoria.
- **Auditar pendências** → chama `audit_missing_dimensions` e abre tabela detalhada.

### Nova tabela "Auditoria de pendências"
Colunas: Produto CRM · Código · SKU · Produto LI · ID LI · SKU LI · Variação · Peso API · Altura API · Largura API · Profundidade API · Fonte consultada · Motivo.

### Seção "Aguardando validação" melhorada
Lista cada item pendente com top 3 candidatos LI + % similaridade. Ações por linha: **Vincular** (grava em `product_external_links` + sync imediato), **Ignorar** (marca `not_found`), **Sem equivalente** (mesmo efeito, sinaliza revisado).

## 3. Orçamento (`Quotes.tsx` / `FreightSummaryCard`)

- Ao detectar item sem peso/dimensão, checar se produto tem vínculo em `product_external_links`.
  - Vinculado sem dados: mensagem "Produto vinculado, mas sem dados logísticos na Loja Integrada."
  - Sem vínculo: mensagem atual ("Produto sem peso/dimensões cadastrados").
- Card de frete só marca "pronto" quando peso, altura, largura e comprimento > 0.

## Detalhes técnicos

- Não altera schema — usamos colunas existentes (`product_external_links.match_candidates jsonb` já existe; se não existir, migração adicional).
- CSV gerado com `Blob` no client, sem lib nova.
- Similaridade: implementação Dice bigram em TS puro no edge function.
- Nenhum campo comercial (preço/estoque/descrição) é tocado.

## Arquivos

- `supabase/functions/loja-integrada/index.ts` — 3 novas actions + reforço `/produto_variacao`.
- `src/pages/LogisticsSyncDiagnostic.tsx` — novos cards, botões, tabela auditoria, painel validação.
- `src/pages/Quotes.tsx` e/ou `src/components/FreightSummaryCard.tsx` — mensagens específicas + indicador "pronto para frete".
- Possível migração para coluna `match_candidates` em `product_external_links` se ainda não existir.

Aprovar para eu implementar em uma única leva.