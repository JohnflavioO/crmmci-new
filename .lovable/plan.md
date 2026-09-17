# Backup completo, seguro e multiempresa

## Objetivo
Substituir o backup atual por uma exportação ZIP completa, conferida e auditável, executada por uma função protegida que lê com privilégio de serviço somente após validar o usuário. O fluxo não dependerá das regras de visualização do usuário logado e não usará IA.

## Banco de dados e segurança
- Criar `backup_audit_log` com solicitante, papel, empresa/escopo, início/fim, duração, status, contagens, verificações, avisos e erro sanitizado.
- Conceder escrita somente ao serviço e leitura a usuários autenticados sob RLS que permita apenas `is_admin()`; gestores não consultarão o histórico diretamente.
- Criar funções SQL `SECURITY DEFINER`, com `search_path` fixo e execução revogada de `public/anon/authenticated`, liberadas somente para `service_role`, para:
  - descobrir dinamicamente as tabelas de `public`;
  - obter páginas e contagens exatas no mesmo escopo;
  - aplicar o mapa multiempresa sem depender de RLS;
  - rejeitar qualquer tabela nova sem regra de escopo com `tabela X sem regra de empresa`.
- Corrigir, mantendo os nomes atuais, as policies SELECT/UPDATE/DELETE de `quote_items` para exigir `is_approved()` e permitir admin, gestor ou dono do pedido. UPDATE terá também `WITH CHECK` equivalente.
- Não alterar autenticação, dados existentes ou outras policies.

## Mapa multiempresa fail-closed
- Classificar cada uma das 69 tabelas atuais em uma regra explícita:
  - `company_id` direto;
  - vínculo por usuário da empresa (`created_by`, `user_id`, `salesperson_id` ou `assigned_user_id`);
  - vínculo pelo pai (pedidos, tarefas, logística, assistência técnica, boletos, financeiro, conversas e contratos);
  - global, incluída apenas no escopo “todas as empresas”;
  - cache/auditoria do próprio backup, sempre excluídos conforme solicitado.
- Em tabelas com `company_id`, incluir no escopo empresarial `company_id = alvo` e também linhas antigas com `company_id IS NULL` quando o proprietário relacionado pertencer à empresa.
- Aplicar as cadeias explícitas solicitadas: itens/mensagens/pagamentos/reciclagens por pedido; tarefas pelo dono; eventos logísticos pelo registro; tabelas técnicas pelo pai; históricos pelo boleto/financeiro; mensagens do assistente pela conversa; notificações e `user_*` pelo usuário.
- Tabelas realmente globais serão omitidas de backups empresariais e registradas em `global_tables_skipped`.
- As credenciais de `integrations` permanecerão exatamente no formato cifrado armazenado; o manifesto avisará que dependem da chave de cifra do servidor.

## Função protegida `backup-export`
- Configurar `verify_jwt = true`, validar o token com `auth.getUser()` e confirmar usuário aprovado com `is_admin()` ou `is_gestor()` antes de criar o cliente de serviço.
- Retornar 401 para sessão inválida e 403 para usuário comum/não aprovado.
- Forçar gestor à própria `current_user_company_id()`, ignorando qualquer empresa enviada. Admin poderá escolher a própria empresa, uma empresa específica ou todas.
- Validar toda entrada com Zod e aceitar somente ações/seções/tabelas/buckets conhecidos.
- Expor operações pequenas e retomáveis: preparação/metadados, uma página, contagem exata, Storage e finalização da auditoria.
- Paginar no máximo 500 linhas por chamada por cursor estável: `(created_at, id)` quando disponível, somente `id` quando não houver `created_at`, e chave primária estável equivalente para tabelas sem `id`; nunca usar offset.
- Usar `auth.admin.listUsers()` paginado para contas e remover campos não autorizados, exportando somente os campos especificados.
- Listar objetos apenas dos nove buckets autorizados. Quando solicitado, fornecer cada arquivo ao navegador por URL assinada curta, sem expor chaves ou tokens.
- Sanitizar erros e nunca devolver/logar segredo, senha, hash ou token de sessão.

## Conteúdo do ZIP
Gerar no navegador com JSZip e preservar exatamente esta ordem lógica:
1. `manifest.json`
2. `01_contas.json`
3. `02_admins.json`
4. `03_usuarios.json`
5. `04_por_usuario/{email-seguro}/pedidos.json` e `clientes.json`
6. `05_pedidos.json`
7. `06_itens.json`
8. `07_tabelas/{tabela}.json` para todas as demais tabelas elegíveis
9. `08_storage/arquivos.json` e, opcionalmente, os binários em `08_storage/{bucket}/...`

Nomes de pasta por e-mail serão normalizados contra barras e caracteres inválidos, sem alterar o e-mail dentro dos dados. `05`, `06` e `07` continuam sendo a fonte canônica para futura restauração.

## Conferência obrigatória
- Comparar cada total exportado com `count(*)` exato calculado no servidor sob o mesmo escopo; qualquer divergência bloqueia geração e download.
- Confirmar que todo item referencia um pedido exportado e que todo pedido com cliente referencia um cliente exportado.
- Contar pedidos com valor positivo sem itens e exibir como aviso destacado, sem bloquear.
- Calcular SHA-256 no navegador para cada arquivo JSON/binário e gravar em `manifest.sections`.
- Só montar o ZIP final quando todas as verificações estiverem aprovadas; registrar o resultado e a duração em `backup_audit_log`.

## Tela
- Manter a rota e o menu atuais, reforçando a proteção para admin/gestor aprovados inclusive no acesso direto.
- Mostrar seletor “Minha empresa” por padrão; admins também verão “Todas as empresas” e empresas disponíveis. Gestores terão o escopo travado na própria empresa.
- Adicionar “Incluir arquivos do Storage”, desmarcada por padrão, com alerta de tamanho e consumo.
- Exibir etapas e contagens: Contas → Admins → Usuários → Por usuário → Pedidos → Itens → Demais tabelas → Storage.
- Mostrar resumo final, verificações, avisos e botão de download `backup-{empresa|todas}-{AAAA-MM-DD-HHmm}.zip` somente após sucesso.
- Listar as últimas exportações autorizadas a partir da auditoria; gestores verão apenas o andamento/resultado da execução atual, pois o histórico persistido é restrito a admin.
- Cancelar com segurança, revogar URLs temporárias e limpar objetos grandes da memória após baixar ou falhar.

## Testes e validação
- Testes unitários do mapa completo: cada tabela atual deve ter exatamente uma regra; tabela nova sem regra deve falhar.
- Testes unitários da paginação por cursor, incluindo timestamps iguais, última página, tabelas sem `created_at` e ausência de duplicação/omissão.
- Testes da função para 401, 403 de vendedor, admin em todas as empresas e gestor forçado à própria empresa mesmo enviando outro `company_id`.
- Testar remoção de senha/hash/token, montagem da estrutura ZIP, hashes e bloqueio por divergência de contagem/referências.
- Validar que `06_itens.json` no escopo total corresponde ao `count(*)` real de `quote_items`.
- Rodar testes seletivos, verificar compilação/logs e testar visualmente a tela em desktop e mobile.
