# Plano de Otimização de Performance

Análise feita no projeto (19.706 linhas em `src/pages`, 456K em componentes, 65+ dependências). Identifiquei os gargalos reais e priorizei os que dão o maior ganho sem risco de quebrar funcionalidades.

## Diagnóstico (gargalos reais encontrados)

### 1. Autenticação faz 8 requisições em série no login (CRÍTICO)
`useAuth` executa 1 SELECT em `profiles` + **7 RPCs** (`is_approved`, `is_admin`, `is_gestor`, `is_financeiro`, `is_logistica`, `is_support_tech`, `is_support_manager`) a cada login. Cada RPC é um round-trip. Isso trava a tela de "Carregando MCI CRM..." por 1-3 segundos antes de qualquer rota renderizar.

**Impacto:** todo primeiro paint depende disso. É a maior causa da lentidão percebida.

### 2. QueryClient sub-configurado
`staleTime: 30s` e sem `gcTime`. Em navegação entre páginas o React Query refaz fetch de listas grandes (clientes, quotes) que acabaram de ser buscadas. Nenhum `refetchOnWindowFocus: false` — cada foco na aba dispara refetches em cascata.

### 3. `Dashboard` importado eager
`App.tsx` importa `Dashboard` sem lazy, mesmo sendo a página inicial pesada. Isso engorda o bundle inicial em ~30KB e atrasa o TTI de rotas que não são o dashboard (logística, financeiro, suporte).

### 4. Suspense fallback é a tela cheia "Carregando MCI CRM..."
Toda troca de rota mostra um splash escuro de tela cheia. Piora muito a percepção de fluidez.

### 5. Notifications Realtime reinscreve em cada mudança de som
O `useEffect` da subscription depende de `preferences.sound_enabled`, então trocar o som desconecta e reconecta o canal Supabase.

### 6. Bundle: chunks pesados não isolados
`framer-motion`, `xlsx`, `@hello-pangea/dnd`, `date-fns` inteiro, `embla-carousel`, `firebase` estão no chunk principal ou mal separados. `xlsx` sozinho tem ~430KB.

### 7. `console.log` em produção
`main.tsx` e `useAuth` fazem logs em todo boot/login. Custo pequeno mas polui e adiciona overhead em mobile.

### 8. Vite config: `modulePreload: false`
Desativa o preload automático de chunks — cada navegação lazy espera o fetch começar do zero. Bom para HTML antigo, ruim para navegação SPA.

## Escopo das mudanças

### Frente A — Auth (maior ganho)
- Substituir as 7 RPCs por **1 SELECT** em `user_roles` (`select role`) paralelo ao `profiles`. Derivar `isAdmin/isGestor/...` no cliente.
- Reduzir timeout de segurança de 8s para 4s (o fetch novo dura <300ms).
- Remover retry+backoff agressivo (3 tentativas × 1s cada); manter 1 retry.
- Remover logs de debug em produção.

### Frente B — React Query & navegação
- `staleTime: 5 min`, `gcTime: 30 min`, `refetchOnWindowFocus: false`, `refetchOnReconnect: 'always'`.
- Trocar Suspense fallback global por um fallback leve (barra fina de progresso no topo em vez de splash cheio). Manter `LoadingScreen` só no boot inicial de auth.
- Lazy-load do `Dashboard`.
- Adicionar prefetch on-hover nos links da sidebar (dispara `import()` do chunk da rota quando o mouse passa).

### Frente C — Bundle
- Ligar `modulePreload: { polyfill: false }` (padrão do Vite).
- Ampliar `manualChunks`: separar `xlsx`, `framer-motion`, `@hello-pangea/dnd`, `embla-carousel-react`, `date-fns` em chunks próprios (só carregados onde usados).
- Confirmar que `firebase`, `pdf` já isolados continuam OK.

### Frente D — Correções pontuais de renderização
- `NotificationsContext`: dividir o effect de realtime — não re-subscrever ao mudar `sound_enabled` (usar `useRef` para ler o valor atual dentro do handler).
- `main.tsx` / `useAuth`: envolver `console.log` com `if (import.meta.env.DEV)`.

## Fora de escopo (intencional)

- Não vou refatorar as páginas gigantes (`Quotes 2423`, `BankSlips 1793`, `Logistics 1431`, `InteligenciaComercial 1518`). Cada uma precisa de análise dedicada e o risco de regressão é alto. Fica sugerido para uma próxima rodada focada por página.
- Não vou trocar bibliotecas (ex.: `date-fns` → `dayjs`, `recharts` → `visx`).
- Não vou mexer no design/CSS/animações — o pedido diz para não alterar design sem necessidade.
- Não vou alterar Supabase (RLS, índices, queries do backend) — as políticas atuais são sensíveis e já existem migrations recentes.

## Detalhes técnicos

### Auth novo (esboço)
```ts
const [{ data: profile }, { data: roles }] = await Promise.all([
  supabase.from('profiles').select('...').eq('user_id', user.id).maybeSingle(),
  supabase.from('user_roles').select('role').eq('user_id', user.id),
]);
const roleSet = new Set((roles ?? []).map(r => r.role));
setIsAdmin(roleSet.has('admin') || profile?.role === 'admin');
// ...
```
Requer `SELECT` policy em `user_roles` para `authenticated` filtrado por `user_id = auth.uid()` — já existe (o `has_role` roda security-definer, mas há também policy padrão para o próprio usuário; se não houver, adiciono migration).

### Suspense fallback leve
Componente `RouteFallback` sem fundo escuro (apenas um `<div className="h-1 bg-emerald-500 animate-pulse fixed top-0"/>`) para evitar flash entre rotas.

### Prefetch on-hover
Wrapper em `NavLink` que faz `onMouseEnter={() => import('./pages/Foo')}`.

## Ordem de execução

1. Frente A (auth) — 1 arquivo
2. Frente B (query client + fallback + lazy Dashboard + prefetch) — 3-4 arquivos
3. Frente C (vite.config) — 1 arquivo
4. Frente D (notifications + logs) — 2 arquivos

Validação: build automático + verificar console/network logs no preview.
