# Área segura de backup

## Objetivo
Criar uma área administrativa para baixar um backup local dos dados comerciais, usando somente consultas ao banco e sem IA ou serviços pagos adicionais.

## Implementação
- Adicionar “Backup de dados” ao menu Administrativo, visível somente para administradores e gestores.
- Criar uma tela protegida com exportação completa em arquivo JSON.
- Incluir propostas, itens das propostas, clientes, produtos e identificação dos vendedores.
- Consultar os dados em páginas para evitar falhas com grande volume e preservar todos os registros permitidos à empresa do usuário.
- Mostrar andamento, quantidade exportada, data do arquivo e mensagens claras de sucesso ou falha.
- Gerar o arquivo somente no navegador do administrador, sem armazenar cópias públicas ou criar custo recorrente.

## Segurança
- Respeitar as regras atuais de acesso e isolamento por empresa do banco.
- Não incluir senhas, tokens, credenciais de integrações ou dados internos de autenticação.
- Impedir acesso à tela por usuários comuns, inclusive por endereço direto.

## Validação
- Verificar compilação e erros do aplicativo.
- Testar acesso administrativo, geração e estrutura do arquivo, além do bloqueio para usuários sem autorização.
