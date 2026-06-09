import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PrivacyProvider } from "@/hooks/usePrivacy";
import ErrorBoundary from "@/components/ErrorBoundary";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";
import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { useFollowUpScanner } from "@/hooks/useFollowUpScanner";
import { clearLocalAppStateAndReload, clearBrowserCachesAndWorkers, isLikelyChunkLoadError, reloadWithCacheBust, shouldRetryChunkLoad } from "@/lib/browserRecovery";

// Eager — pequenas / sempre necessárias
import Auth from "./pages/Auth";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import ForcePasswordChange from "./pages/ForcePasswordChange";

const lazyWithRecovery = <T extends { default: ComponentType<any> }>(loader: () => Promise<T>) =>
  lazy(() =>
    loader().catch(async (error) => {
      if (isLikelyChunkLoadError(error) && shouldRetryChunkLoad()) {
        await clearBrowserCachesAndWorkers();
        reloadWithCacheBust();
      }
      throw error;
    })
  );

// Lazy — code-splitting acelera muito o preview e se recupera de chunks antigos em cache
const Dashboard = lazyWithRecovery(() => import("./pages/Dashboard"));
const OperationalCenter = lazyWithRecovery(() => import("./pages/OperationalCenter"));
const Clients = lazyWithRecovery(() => import("./pages/Clients"));
const Quotes = lazyWithRecovery(() => import("./pages/Quotes"));
const Approvals = lazyWithRecovery(() => import("./pages/Approvals"));
const Products = lazyWithRecovery(() => import("./pages/Products"));
const EcoflowCalculator = lazyWithRecovery(() => import("./pages/EcoflowCalculator"));
const Tasks = lazyWithRecovery(() => import("./pages/Tasks"));
const Metrics = lazyWithRecovery(() => import("./pages/Metrics"));
const Pipeline = lazyWithRecovery(() => import("./pages/Pipeline"));
const Reports = lazyWithRecovery(() => import("./pages/Reports"));
const PublicQuote = lazyWithRecovery(() => import("./pages/PublicQuote"));
const Negociacoes = lazyWithRecovery(() => import("./pages/Negociacoes"));
const Integrations = lazyWithRecovery(() => import("./pages/Integrations"));
const Financial = lazyWithRecovery(() => import("./pages/Financial"));
const Logistics = lazyWithRecovery(() => import("./pages/Logistics"));
const EstoqueSC = lazyWithRecovery(() => import("./pages/EstoqueSC"));
const ProspectView = lazyWithRecovery(() => import("./pages/ProspectView"));
const BankSlips = lazyWithRecovery(() => import("./pages/BankSlips"));
const SupportLayout = lazyWithRecovery(() => import("./components/support/SupportLayout"));
const SupportDashboard = lazyWithRecovery(() => import("./pages/support/SupportDashboard"));
const SupportClients = lazyWithRecovery(() => import("./pages/support/SupportClients"));
const SupportStock = lazyWithRecovery(() => import("./pages/support/SupportStock"));
const SupportOrders = lazyWithRecovery(() => import("./pages/support/SupportOrders"));
const SupportOrderDetail = lazyWithRecovery(() => import("./pages/support/SupportOrderDetail"));
const SupportPurchases = lazyWithRecovery(() => import("./pages/support/SupportPurchases"));
const SupportBudgets = lazyWithRecovery(() => import("./pages/support/SupportBudgets"));
const SupportCloud = lazyWithRecovery(() => import("./pages/support/SupportCloud"));
const SupportReports = lazyWithRecovery(() => import("./pages/support/SupportReports"));
const SupportMaintenance = lazyWithRecovery(() => import("./pages/support/SupportMaintenance"));
const PublicTracking = lazyWithRecovery(() => import("./pages/support/PublicTracking"));
const LogisticsTracking = lazyWithRecovery(() => import("./pages/LogisticsTracking"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 30_000,
    },
  },
});

function LoadingScreen() {
  const [showRetry, setShowRetry] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    // 4 segundos para mostrar opção de retry se o loading screen não sumir
    const timer = setTimeout(() => setShowRetry(true), 4000);
    
    const checkErrors = () => {
      const params = new URLSearchParams(window.location.hash.replace('#', '?'));
      if (params.get('error')) {
        setErrorDetails(`Erro de autenticação: ${params.get('error_description') || params.get('error')}`);
      }
    };
    checkErrors();

    return () => clearTimeout(timer);
  }, []);

  const handleForceRecovery = () => {
    void clearLocalAppStateAndReload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f2b26] gap-6 p-6 font-sans">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full" />
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="text-center space-y-4 max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-1">
          <p className="text-xl font-bold text-white font-display tracking-tight">MCI Store CRM</p>
          <p className="text-sm text-emerald-400/80 animate-pulse">Iniciando sistema...</p>
        </div>
        
        {errorDetails && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-[10px] text-red-400 leading-tight">{errorDetails}</p>
          </div>
        )}

        {showRetry && (
          <div className="pt-4 space-y-3 animate-in zoom-in duration-300">
            <p className="text-[10px] text-white/40">O carregamento está demorando. Tente recarregar.</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-all"
              >
                Recarregar Agora
              </button>
              <button 
                onClick={handleForceRecovery}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-[10px] font-medium transition-all"
              >
                Limpar Cache e Sair
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, isApproved, isAdmin, isGestor, isFinanceiro, isLogistica, isSupportTech, isSupportManager, isSupport, forcePasswordChange, profile, signOut } = useAuth();
  
  // Scanner de follow-up otimizado: roda apenas após o auth estar pronto e o usuário estar aprovado
  useFollowUpScanner();

  useEffect(() => {
    if (user && !loading) {
      console.log('[App] Auth status:', { email: user.email, hasProfile: !!profile, loading });
    }
  }, [user, loading, profile]);

  if (loading) {
    return <LoadingScreen />;
  }

  // O usuário só é considerado pendente se estiver logado, NÃO for admin/gestor/etc, e a flag isApproved for explicitamente falsa
  // Se não tiver perfil ainda, também consideramos como aguardando (ou em processo de criação)
  const isPendingApproval = user && !loading && 
    !(profile?.role && ['admin', 'gestor', 'vendedor', 'comercial', 'financeiro', 'logistica', 'support_tech', 'support_manager'].includes(profile.role.toLowerCase())) &&
    !isAdmin && !isGestor && !isFinanceiro && !isLogistica && !isSupport && !isApproved;




  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/quote/:token" element={<PublicQuote />} />
          <Route path="/rastreamento/os/:token" element={<PublicTracking />} />
          <Route path="*" element={<Auth />} />
        </Routes>
      </Suspense>
    );
  }

  if (isPendingApproval) return <PendingApproval />;
  if (forcePasswordChange) return <ForcePasswordChange />;

  const isLogisticaOnly = isLogistica && !isAdmin && !isGestor && !isFinanceiro;
  const isFinanceiroOnly = isFinanceiro && !isGestor && !isAdmin;
  const isSupportOnly = isSupport && !isAdmin && !isGestor && !isFinanceiro && !isLogistica;

  return (
    <Suspense fallback={<LoadingScreen />}>
    <Routes>
      {/* Public tracking is always available */}
      <Route path="/rastreamento/os/:token" element={<PublicTracking />} />

      {/* Support module */}
      {(isSupport || isAdmin || isGestor) && (
        <Route path="/suporte" element={<SupportLayout />}>
          <Route index element={<SupportDashboard />} />
          <Route path="dashboard" element={<SupportDashboard />} />
          <Route path="estoque" element={<SupportStock />} />
          <Route path="clientes" element={<SupportClients />} />
          <Route path="os" element={<SupportOrders />} />
          <Route path="os/:id" element={<SupportOrderDetail />} />
          <Route path="compras" element={<SupportPurchases />} />
          <Route path="orcamentos" element={<SupportBudgets />} />
          <Route path="nuvem" element={<SupportCloud />} />
          <Route path="relatorios" element={<SupportReports />} />
          <Route path="manutencao" element={<SupportMaintenance />} />
        </Route>
      )}

      {/* Commercial/Main Routes */}
      {!isSupportOnly && (
        <>
          <Route path="/" element={
            isLogisticaOnly ? <Navigate to="/logistics" replace /> :
            isFinanceiroOnly ? <Navigate to="/financial" replace /> :
            <Navigate to="/dashboard" replace />
          } />
          <Route path="/operational" element={<OperationalCenter />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/products" element={<Products />} />
          <Route path="/ecoflow" element={<EcoflowCalculator />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/quote/:token" element={<PublicQuote />} />
          <Route path="/negociacoes" element={<Negociacoes />} />
          <Route path="/prospect" element={<ProspectView />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/logistics" element={<Logistics />} />
          <Route path="/estoque-sc" element={<EstoqueSC />} />
          {(isGestor || isFinanceiro) && <Route path="/financial" element={<Financial />} />}
          {(isGestor || isFinanceiro) && <Route path="/bank-slips" element={<BankSlips />} />}
          {(isAdmin || isGestor) && <Route path="/approvals" element={<Approvals />} />}
          {isAdmin && <Route path="/integrations" element={<Integrations />} />}
        </>
      )}

      {/* Redirect Support Only users away from commercial roots if they hit them */}
      {isSupportOnly && (
        <Route path="/" element={<Navigate to="/suporte" replace />} />
      )}

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <PrivacyProvider>
                <AppRoutes />
                <Toaster />
                <Sonner position="top-right" closeButton />
                <PWAUpdatePrompt />
              </PrivacyProvider>
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
