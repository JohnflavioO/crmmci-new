# Corrigir fila de Pré-vendas da Logística

## Objetivo
Exibir para a equipe de Logística todas as propostas da empresa que estejam com status **Pré-venda** ou tenham ao menos um item marcado como pré-venda, independentemente do vendedor, e permitir iniciar o processamento do pedido.

## Implementação
- Corrigir a regra de acesso do backend que hoje deixa a Logística consultar apenas propostas já vinculadas a `logistics_records`; esse é o motivo de somente 3 aparecerem, embora existam muitas outras pré-vendas sem vínculo.
- Manter o isolamento por empresa: a Logística verá as pré-vendas de todos os vendedores da própria empresa, nunca de outra empresa.
- Ajustar a consulta da tela para unir corretamente:
  - propostas com status Pré-venda;
  - propostas com qualquer item marcado como pré-venda;
  - excluindo apenas propostas canceladas/rejeitadas.
- Exibir as propostas ainda não processadas como pendentes na fila de Pré-vendas.
- Adicionar a ação **Baixar pedido / Iniciar logística** nas linhas pendentes. A ação criará o registro operacional com status inicial **Aguardando Entrada**, usando a empresa da sessão e sem permitir IDs de empresa enviados livremente pelo usuário.
- Após a inclusão, atualizar a lista e os contadores; o pedido deixa a fila pendente de Pré-vendas e passa para o fluxo operacional.

## Validação
- Comparar os totais do banco com o contador e as linhas visíveis na conta de Logística.
- Testar uma proposta de outro vendedor da mesma empresa.
- Acionar **Baixar pedido**, confirmar a criação do registro e verificar sua aparição em **Aguardando NF/Entrada**.
- Verificar que propostas de outras empresas permanecem invisíveis e que não há erros no build ou no navegador.

## Detalhes técnicos
- Alterar somente as políticas/RPCs necessárias de `quotes`, `quote_items` e `logistics_records` por migração controlada.
- Preservar as regras comerciais atuais da proposta e os demais estágios da Logística.
