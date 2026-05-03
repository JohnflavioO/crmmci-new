import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ErrorBoundary";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";

import Auth from "./pages/Auth";
import PendingApproval from "./pages/PendingApproval";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Quotes from "./pages/Quotes";
import Approvals from "./pages/Approvals";
import Products from "./pages/Products";
import EcoflowCalculator from "./pages/EcoflowCalculator";
import Tasks from "./pages/Tasks";
import Metrics from "./pages/Metrics";
import Pipeline from "./pages/Pipeline";
import Reports from "./pages/Reports";
import PublicQuote from "./pages/PublicQuote";
import Negociacoes from "./pages/Negociacoes";
import Integrations from "./pages/Integrations";
import Financial from "./pages/Financial";
import Logistics from "./pages/Logistics";
import NotFound from "./pages/NotFound";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import EstoqueSC from "./pages/EstoqueSC";
import { useEffect, useState } from "react";
import { useFollowUpScanner } from "@/hooks/useFollowUpScanner";
import ProspectView from "./pages/ProspectView";
import BankSlips from "./pages/BankSlips";

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
    const timer = setTimeout(() => setShowRetry(true), 8000);
    
    const checkErrors = () => {
      if (window.location.hash.includes('error=')) {
        setErrorDetails('Erro na autenticação detectado.');
      }
    };
    checkErrors();

    return () => clearTimeout(timer);
  }, []);

  const handleForceRecovery = () => {
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(n => caches.delete(n)));
    }
    window.location.href = '/';
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
          <p className="text-sm text-emerald-400/80 animate-pulse">Iniciando módulos do sistema...</p>
        </div>
        
        {errorDetails && (
          <p className="text-xs text-red-400 bg-red-950/30 p-2 rounded border border-red-500/20">{errorDetails}</p>
        )}

        {showRetry && (
          <div className="pt-4 space-y-3 animate-in zoom-in duration-300">
            <p className="text-xs text-white/40">O sistema está demorando para responder.</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-emerald-900/20 active:scale-95 flex items-center justify-center gap-2"
              >
                Tentar Novamente
              </button>
              <button 
                onClick={handleForceRecovery}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-xs font-medium transition-all"
              >
                Limpar Sessão e Cache
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, isApproved, isAdmin, isGestor, isFinanceiro, isLogistica, forcePasswordChange, profile, signOut } = useAuth();
  
  // Scanner de follow-up otimizado: roda apenas após o auth estar pronto e o usuário estar aprovado
  useFollowUpScanner();

  useEffect(() => {
    if (user && !loading) {
      console.log('[App] Auth status:', { email: user.email, hasProfile: !!profile, loading });
    }
  }, [user, loading, profile]);

  if (loading) {
    return (
      <ErrorBoundary>
        <LoadingScreen />
      </ErrorBoundary>
    );
  }

  // O usuário só é considerado pendente se estiver logado, NÃO for admin/gestor/etc, e a flag isApproved for explicitamente falsa
  // Se não tiver perfil ainda, também consideramos como aguardando (ou em processo de criação)
  const isPendingApproval = user && !loading && 
    !(profile?.role && ['admin', 'gestor', 'vendedor', 'comercial', 'financeiro', 'logistica'].includes(profile.role.toLowerCase())) &&
    !isAdmin && !isGestor && !isFinanceiro && !isLogistica && !isApproved;


  if (!user) {
    return (
      <Routes>
        <Route path="/quote/:token" element={<PublicQuote />} />
        <Route path="*" element={<Auth />} />
      </Routes>
    );
  }

  if (isPendingApproval) return <PendingApproval />;
  if (forcePasswordChange) return <ForcePasswordChange />;

  const isLogisticaOnly = isLogistica && !isAdmin && !isGestor && !isFinanceiro;
  const isFinanceiroOnly = isFinanceiro && !isGestor && !isAdmin;

  return (
    <Routes>
      <Route path="/" element={
        isLogisticaOnly ? <Navigate to="/logistics" replace /> :
        isFinanceiroOnly ? <Navigate to="/financial" replace /> :
        <Dashboard />
      } />
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
              <Toaster />
              <Sonner position="top-right" closeButton />
              <PWAUpdatePrompt />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
