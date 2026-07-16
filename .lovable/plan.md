# Comparador Inteligente de Equipamentos

Nova ferramenta para consultores comerciais encontrarem rapidamente o produto MCI equivalente a partir de nome, código, SKU, marca, URL de concorrente ou texto livre. Usa IA (Lovable AI Gateway) apenas para interpretar/comparar — nunca para inventar produtos. Resultados sempre vêm do catálogo `products` do CRM.

## Localização na navegação

- Novo item no menu lateral: **Ferramentas → Comparador Inteligente** (`/comparador`).
- Botão **"Encontrar equivalente"** dentro da tela de Orçamentos (linha de item / toolbar do orçamento). Ao escolher um resultado, o produto é adicionado ao orçamento atual.

## Fluxo de uso

1. Usuário digita: texto livre, nome, modelo, código, SKU, marca ou URL.
2. Sistema decide o modo:
   - **URL** → Edge Function `scrape-competitor-product` faz fetch seguro (validação de URL, timeout, sem IPs privados) e extrai título/descrição/marca/modelo/specs de OG tags + JSON-LD.
   - **Texto/nome** → IA extrai `{ marca, modelo, categoria, tipo, specs[] }`.
3. Edge Function `find-equivalent-product` faz **pré-filtro no banco** (SKU exato → código → trigram em nome/marca/categoria) e retorna ~20 candidatos.
4. IA (`google/gemini-3-flash-preview`) recebe apenas o produto pesquisado + os 20 candidatos e devolve top 3 com `compatibility` (0-100), `reasons[]`, `similarities[]`, `differences[]`, `pros[]`, `cons[]`.
5. UI renderiza cards (imagem, nome, marca, preço, disponibilidade, % compatibilidade). Botões: **Abrir produto**, **Adicionar ao orçamento**, **Comparar detalhes** (drawer lado a lado).
6. Usuário pode marcar **"Esse é o equivalente correto"** → grava em `product_equivalences` para reuso futuro.

## Cache e aprendizado

- Antes de chamar IA, consultar `product_equivalences` por `url_externa` / `(marca_externa, modelo_externo)` — se aprovado, retornar direto.
- Cache de análise de URL/texto em `equivalence_search_cache` (hash da entrada → JSON de specs extraídas + candidatos). TTL 30 dias, invalidável manualmente.
- Histórico das buscas em `equivalence_search_history` (usuário, entrada, resultado escolhido, tempo, favorito).

## Banco de dados

Migrations:

- `product_equivalences` — id, produto_externo, marca_externa, modelo_externo, url_externa, mci_product_id (FK products), confidence, approved_by, approved_at, notes, company_id, created_at, updated_at.
- `equivalence_search_history` — id, user_id, company_id, input_type (`url|text|sku`), input_value, extracted_specs jsonb, chosen_product_id, response_time_ms, is_favorite, created_at.
- `equivalence_search_cache` — id, input_hash (unique), input_type, extracted_specs jsonb, candidates jsonb, created_at, expires_at.

Todas com RLS: leitura/escrita restrita a `is_approved()` e escopo por `company_id` (quando aplicável). Grants padrão para `authenticated` + `service_role`. Índices trigram em `products.name` / `products.brand` já existem via `pg_trgm`.

## Edge Functions

- `scrape-competitor-product` — recebe URL, valida (bloqueia loopback/privado), timeout 15s, extrai OG/JSON-LD/microdata (reaproveita padrões de `scrape-product`).
- `find-equivalent-product` — recebe `{ input, mode }`, autentica via `getClaims`, aplica cache/equivalences aprovadas, faz pré-filtro SQL (ILIKE + trigram) via `supabase.rpc('search_products_candidates', …)` ou query direta, chama Lovable AI Gateway com prompt estruturado (Output.object com Zod), grava histórico e cache, retorna top 3.
- Trata 429/402 do gateway com mensagens claras.

## Frontend

- `src/pages/EquipmentComparator.tsx` — página principal (barra de busca com debounce 400ms, lista de resultados em cards, drawer de comparação lado a lado, aba de histórico + favoritos + equivalências aprovadas).
- `src/components/comparator/ComparatorSearchBar.tsx`, `ResultCard.tsx`, `CompareDrawer.tsx`, `EquivalenceConfirmButton.tsx`.
- `src/components/comparator/FindEquivalentDialog.tsx` — reutilizável dentro de Orçamentos.
- Integração em `src/pages/Quotes.tsx` (ou no editor de itens do orçamento) com botão **Encontrar equivalente** que abre o dialog e faz `addItem(product)` ao confirmar.
- Rota registrada em `src/App.tsx` com `lazyWithRetry`.
- Item de menu em `src/components/AppSidebar.tsx` sob "Ferramentas".
- Hooks: `useEquivalentSearch` (React Query, `mutation`), `useSearchHistory`, `useApprovedEquivalences`.

## Segurança

- Toda chamada de IA e scraping em Edge Functions com `verify_jwt` padrão + `getClaims`.
- `LOVABLE_API_KEY` já provisionado — usado no gateway.
- Validação de URL: apenas `http/https`, resolve DNS e bloqueia ranges privados; length ≤ 2000.
- Zod para validar payloads de entrada e saída da IA.
- Nenhum conteúdo protegido é persistido — só metadados/specs.

## Performance

- React Query com `staleTime` 5min para histórico e equivalências.
- Debounce 400ms na busca; busca só dispara com ≥ 3 caracteres ou URL válida.
- Pré-filtro SQL limita a 20 candidatos antes da IA.
- Cache por hash de entrada evita reprocessar.
- Lazy load da rota.

## Critérios de aceite

- Buscar por nome, SKU, código, marca, URL, texto livre.
- Mostrar cards com % compatibilidade, motivos, semelhanças, diferenças, prós/contras.
- Adicionar produto ao orçamento a partir do resultado.
- Confirmar equivalência salva em `product_equivalences` e é reusada.
- Histórico e favoritos por usuário.
- Nenhum produto fora do catálogo é retornado. Se confiança < 60, exibe "Não encontramos um equivalente com confiança suficiente."
- Visual alinhado ao restante do CRM (cards/tabelas, sem estética de chatbot).
