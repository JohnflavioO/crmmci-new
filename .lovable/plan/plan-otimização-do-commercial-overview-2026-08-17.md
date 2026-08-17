# Plan - Otimização do Commercial Overview

Otimizar o handler `getCommercialOverview` para reduzir o consumo de memória e processamento na Edge Function, mantendo a integridade total dos dados.

## Alterações Técnicas

### 1. Backend (`supabase/functions/_shared/crm-handlers.ts`)
- **Filtro Temporal Nativo**: Adicionar suporte a `days_back`, `from` e `to` no `getCommercialOverview`. Atualmente ele carrega os últimos 5000/10000 orçamentos sem critério de data, o que é ineficiente para a Inteligência Comercial que muitas vezes foca em períodos curtos.
- **Seleção de Colunas**: Restringir o `select()` para apenas as colunas consumidas pelo frontend (ex: remover metadados internos não utilizados).
- **Chunking de Itens**: Otimizar a consulta de `quote_items` para carregar apenas itens de orçamentos que passaram nos filtros de período e status.
- **Unificação de Lógica**: Ajustar `getClientRanking` para que ele possa utilizar filtros mais granulares, evitando que o `getCommercialOverview` seja o único caminho de carga massiva.

### 2. Frontend (`src/pages/InteligenciaComercial.tsx`)
- **Lazy Loading de Períodos**: Ajustar o `loadCommercialData` para passar o filtro de período selecionado pelo usuário para o backend.
- **Cache Inteligente**: Otimizar a `queryKey` do React Query para incluir o período, permitindo cache seletivo no navegador.

## Validação e Métricas
- Comparar o `row_count` e `duration_ms` nos diagnósticos da Edge Function antes e depois.
- Verificar se os KPIs (Receita, Ticket Médio, Top Clientes) permanecem idênticos bit-a-bit.
- Validar o isolamento por `company_id` e permissões de perfil.

## Technical Details
- **Tables**: `quotes`, `quote_items`, `clients`, `products`, `profiles`.
- **Primary Change**: SQL-side filtering vs Memory-side filtering.
- **Payload Goal**: ~50% reduction in average JSON size by column pruning.
