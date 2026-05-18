text
# FASE 1: Melhoria de UX e Operacionalidade - CRM MCI

O objetivo é transformar o sistema de um cadastro estático em uma central operacional inteligente, focada em produtividade e contexto.

## 1. Auditoria e "Clicabilidade" (Quick Fixes)
- **Cards do Dashboard**: Tornar todos os `StatCard` no Dashboard interativos. Clicar em "Aprovados" levará para a lista filtrada de orçamentos aprovados, etc.
- **Contextualização**: Adicionar links rápidos em tabelas para abrir detalhes de clientes e orçamentos sem perder o contexto (uso de Side Panels ou Modais quando apropriado).

## 2. Central Operacional por Perfil (Dashboard Inteligente)
Refatoração do `Dashboard.tsx` para apresentar widgets baseados na Role do usuário:

### Vendedor
- **Follow-ups Atrasados**: Lista prioritária de contatos pendentes.
- **Propostas sem Retorno**: Alerta de orçamentos enviados há mais de X dias sem status de aprovação.
- **Oportunidades**: Clientes prospectados que ainda não têm orçamentos.

### Gestor
- **Funil Travado**: Identificação de gargalos (ex: muitos orçamentos parados no status 'sent').
- **Vendedores Inativos**: Lista de membros da equipe sem atividade recente de follow-up.
- **Previsão de Fechamento**: Visão consolidada de valores em negociação.

### Financeiro
- **Alertas de Inadimplência**: Integração com a visualização de boletos vencidos.
- **Cobranças Urgentes**: Lista de orçamentos aprovados aguardando confirmação de pagamento.

### Suporte Técnico
- **Ordens de Serviço (OS) em Gargalo**: Visualização de OS aguardando peças ou aprovação de orçamento técnico.

## 3. Navegação e Produtividade (Atalhos e Quick Actions)
- **Menu Lateral Inteligente**: Agrupar itens por fluxos operacionais (Comercial, Operacional, Administrativo).
- **Barra de Busca Global**: (Futuro) Atalho `Cmd+K` para busca rápida de Clientes/Orçamentos.
- **Ações Inline**: Botão de "Gerar Follow-up" ou "Mudar Status" diretamente na listagem, sem precisar entrar no detalhe do registro.

## Detalhes Técnicos
- Implementação de **Side Panels (Sheet)** em substituição a navegações completas de página para consultas rápidas.
- Uso intensivo de **Badges Dinâmicos** para indicar urgência (ex: "Atrasado" em vermelho pulsante).
- Melhoria no componente `StatCard` para suportar comportamentos de drill-down específicos.
- Centralização de lógica de filtragem no `Dashboard.tsx` para refletir as dores de cada setor citadas no briefing.
