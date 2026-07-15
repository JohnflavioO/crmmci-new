# Assinatura Eletrônica de Contratos — Fase 1

Entrega o fluxo end-to-end de envio, validação por OTP e assinatura eletrônica de contratos, com todas as evidências gravadas. Provider inicial nativo (`mci_native`), atrás de uma interface `SignatureProvider` que permite trocar por Clicksign/D4Sign/DocuSign no futuro sem tocar no módulo de contratos.

Fase 2 (não incluída aqui): certificado de evidências em PDF com QR de validação pública, timeline visual completa no drawer, página `/validar-assinatura/:code`, adaptadores stub para provedores externos.

## O que a Fase 1 entrega

- Enviar contrato para assinatura por link seguro (email via Resend + copiar link para WhatsApp).
- Página pública `/assinar-contrato/:token` sem login no CRM, com visualizador de PDF, aceite de termos, OTP por email e assinatura (digitada ou desenhada).
- Contrato fica imutável após envio; alterações exigem cancelar e reemitir.
- PDF assinado gerado com selo visual (nome, CPF mascarado, data/hora, ID da assinatura) e hash SHA-256.
- Histórico do Gerador de Contratos com novos status em PT-BR, badges, e ações: Enviar, Copiar link, Reenviar, Cancelar, Ver contrato, Baixar original, Baixar assinado.
- Trilha de auditoria completa (`contract_signature_events`) com IP, user-agent, timestamps.
- RLS por `company_id`, buckets privados, token público forte armazenado só como hash, OTP com expiração e limite de tentativas.
- Notificação ao responsável comercial quando o contrato é assinado ou recusado.

## Banco de dados

Migration única criando:

- Enum `contract_signature_status`: `draft, ready_to_send, sent, viewed, awaiting_signature, signed, refused, expired, cancelled`.
- Enum `contract_signature_event_type` com todos os eventos listados no pedido.
- Tabela `contract_signature_requests` com os campos especificados + `otp_code_hash`, `otp_expires_at`, `otp_attempts`, `provider` default `mci_native`.
- Tabela `contract_signature_events` com os campos especificados.
- Coluna `signature_status` em `generated_contracts` para refletir o estado corrente.
- Buckets privados: `contract-originals`, `contract-signed`, `contract-evidence`.
- GRANTs + RLS: `authenticated` só enxerga registros do próprio `company_id`; `service_role` acessa tudo (edge functions); `anon` sem acesso direto — a página pública opera exclusivamente via edge functions com `service_role`.
- Trigger de `updated_at` e trigger que preenche `company_id` a partir do contrato.

## Arquitetura de providers

`supabase/functions/_shared/signature-providers/`

```text
types.ts          -> interface SignatureProvider { createSignatureRequest,
                     getSignatureStatus, cancelSignatureRequest,
                     downloadSignedDocument, processWebhook }
mci-native.ts     -> implementação nativa completa (Fase 1)
registry.ts       -> resolve provider por nome; default 'mci_native'
```

O frontend e o módulo de contratos nunca importam `mci-native` diretamente — sempre passam pelo edge function, que passa pelo registry.

## Edge functions (novas)

- `contract-signature-send` — valida contrato, gera PDF final, calcula SHA-256, faz upload no bucket original, cria `signature_request`, dispara email via Resend com o link.
- `contract-signature-public` — endpoint público (`verify_jwt=false`) que valida token, retorna metadados sanitizados do contrato + URL assinada de download do PDF, registra `link_opened` / `document_viewed`.
- `contract-signature-otp` — gera e valida OTP (hash + expiração + max 5 tentativas + rate limit por IP).
- `contract-signature-sign` — valida OTP + aceite + hash do documento, gera PDF assinado com selo visual (pdf-lib), calcula novo hash, faz upload no bucket assinado, atualiza status para `signed`, cria notificação para o `created_by`.
- `contract-signature-cancel` / `contract-signature-resend` — ações do dono.

Todas registram evento em `contract_signature_events` com IP e user-agent.

## Frontend

- `src/lib/signature/statusLabels.ts` — labels PT-BR, cores e ícones para badges.
- `src/pages/ContractGenerator.tsx` — no histórico: badge de status, menu de ações novas; drawer "Detalhes da assinatura" com timeline básica (lista de eventos) e botões de download.
- `src/components/contracts/SendForSignatureDialog.tsx` — coleta nome, CPF, email, telefone e validade; chama `contract-signature-send`; ao voltar mostra o link copiável.
- `src/pages/PublicSignContract.tsx` — nova rota pública `/assinar-contrato/:token`, sem auth, visual MCI: cabeçalho, dados do contrato, visualizador de PDF (iframe da URL assinada), etapa 1 confirmar identidade → etapa 2 receber OTP → etapa 3 aceitar termos + assinar (digitada/desenhada com `react-signature-canvas`) → tela final com download do PDF assinado.
- Rota adicionada em `App.tsx` no bloco público (fora do gate de auth), com `SafeRoute`.

Visual: usa componentes shadcn já existentes, paleta e tipografia do CRM (`#0f2b26`, verde MCI). Nada de estilo "IA/futurista".

## Segurança aplicada

- Token público = 32 bytes aleatórios base64url; DB armazena só SHA-256; edge function compara hash.
- OTP = 6 dígitos, hash SHA-256, expira em 10 min, máx 5 tentativas, incrementa contador em cada tentativa errada.
- URLs de download sempre assinadas com validade de 5 min.
- CPF mascarado (`***.***.***-XX`) em qualquer resposta pública e em logs.
- Nenhum service key exposto no frontend; toda operação sensível em edge function.
- Após `sent`, um trigger impede update em campos-conteúdo de `generated_contracts` enquanto houver `signature_request` ativa.
- Hash do documento validado antes de assinar (garante que o PDF servido é o mesmo assinado).
- Webhook handler já preparado com idempotência por `provider_request_id + event_type`.

## Dependências / conectores

- Requer conector Resend conectado ao projeto (o usuário confirmou). Se `RESEND_API_KEY` não estiver disponível no momento do envio, retorno erro claro em vez de fingir sucesso.
- `pdf-lib` já usado em outras funções; sem novos pacotes no frontend além de `react-signature-canvas`.

## Critérios de aceite cobertos na Fase 1

Itens 1–6 e 8–12 do pedido original. O item 7 (certificado de evidências em PDF) fica pronto como estrutura de dados na Fase 1 e o PDF é gerado na Fase 2.
