# Otimização urgente de consumo do CRM MCI

## Objetivo
Reduzir leituras, processamento e tráfego sem alterar telas, regras, permissões, RLS, escopos ou experiência.

## Cinco focos iniciais
1. **Acesso do usuário** — remover a consulta automática a cada 45 segundos e deduplicar atualizações simultâneas; manter atualização no login e no evento explícito de mudança de permissão.
2. **Changelog e versão** — compartilhar cache entre componentes, selecionar apenas campos usados e trocar verificações periódicas por cache/revalidação controlada.
3. **Produtos** — manter paginação, substituir `SELECT *` pelas colunas usadas e limitar melhor a busca, preservando ranking e resultados visíveis.
4. **Clientes** — evitar baixar toda a base e todos os orçamentos repetidamente; aproveitar cache e restringir colunas, mantendo filtros e ações atuais.
5. **Financeiro/Assistente** — reduzir cargas integrais e cálculos no navegador usando consultas enxutas e agregações/handlers já existentes, sem substituir a arquitetura compartilhada.

## Implementação segura
- Preservar `staleTime`, `scopeCompany`, `scopeOwn`, RLS, handlers compartilhados e RPCs comerciais existentes.
- Não criar subscriptions, schema, índices ou migrações sem evidência direta de necessidade.
- Não alterar layout, textos, fluxos, filtros ou permissões.
- Aplicar somente mudanças com resultado equivalente e invalidação após gravações.

## Validação
- Comparar quantidade de chamadas e volume de colunas antes/depois nos pontos alterados.
- Executar testes relevantes, verificar compilação e navegar pelos módulos afetados.
- Conferir novamente consultas lentas e registrar estimativa conservadora de economia.
