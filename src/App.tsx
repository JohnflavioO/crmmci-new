import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PrivacyProvider } from "@/hooks/usePrivacy";
import ErrorBoundary from "@/components/ErrorBoundary";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";
import AppVersionBanner from "./components/AppVersionBanner";
import { Suspense, type ReactNode } from "react";
import { useFollowUpScanner } from "@/hooks/useFollowUpScanner";

// Eager imports for stability
import Auth from "./pages/Auth";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import Dashboard from "./pages/Dashboard";
import OperationalCenter from "./pages/OperationalCenter";
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
import EstoqueSC from "./pages/EstoqueSC";
import ProspectView from "./pages/ProspectView";
import BankSlips from "./pages/BankSlips";
import SupportLayout from "./components/support/SupportLayout";
import SupportDashboard from "./pages/support/SupportDashboard";
import SupportClients from "./pages/support/SupportClients";
import SupportStock from "./pages/support/SupportStock";
import SupportOrders from "./pages/support/SupportOrders";
import SupportOrderDetail from "./pages/support/SupportOrderDetail";
import SupportPurchases from "./pages/support/SupportPurchases";
import SupportBudgets from "./pages/support/SupportBudgets";
import SupportCloud from "./pages/support/SupportCloud";
import SupportReports from "./pages/support/SupportReports";
import SupportMaintenance from "./pages/support/SupportMaintenance";
import PublicTracking from "./pages/support/PublicTracking";
import LogisticsTracking from "./pages/LogisticsTracking";
import ContractGenerator from "./pages/ContractGenerator";
import Help from "./pages/Help";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f2b26] gap-4 p-6">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-white font-medium animate-pulse">Carregando MCI CRM...</p>
    </div>
  );
}

function SafeRoute({ children }: { children: ReactNode }) {
  return <ErrorBoundary title="Erro ao carregar esta área">{children}</ErrorBoundary>;
}

function RedirectPreservingSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function AppRoutes() {
  const { user, loading, isApproved, isAdmin, isGestor, isFinanceiro, isLogistica, isSupport, forcePasswordChange, profile } = useAuth();
  
  useFollowUpScanner();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/quote/:token" element={<SafeRoute><PublicQuote /></SafeRoute>} />
          <Route path="/rastreamento/os/:token" element={<SafeRoute><PublicTracking /></SafeRoute>} />
          <Route path="/rastreio/pedido/:token" element={<SafeRoute><LogisticsTracking /></SafeRoute>} />
          <Route path="*" element={<Auth />} />
        </Routes>
      </Suspense>
    );
  }

  if (forcePasswordChange) return <ForcePasswordChange />;
  
  // Pending approval logic
  const hasValidRole = profile?.role && ['admin', 'gestor', 'vendedor', 'comercial', 'financeiro', 'logistica', 'support_tech', 'support_manager'].includes(profile.role.toLowerCase());
  const isPending = !isAdmin && !isGestor && !isFinanceiro && !isLogistica && !isSupport && !isApproved && !hasValidRole;

  if (isPending) return <PendingApproval />;

  const isLogisticaOnly = isLogistica && !isAdmin && !isGestor && !isFinanceiro;
  const isFinanceiroOnly = isFinanceiro && !isGestor && !isAdmin;
  const isSupportOnly = isSupport && !isAdmin && !isGestor && !isFinanceiro && !isLogistica;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/rastreamento/os/:token" element={<SafeRoute><PublicTracking /></SafeRoute>} />
        <Route path="/rastreio/pedido/:token" element={<SafeRoute><LogisticsTracking /></SafeRoute>} />
        <Route path="/ajuda" element={<SafeRoute><Help /></SafeRoute>} />


        {(isSupport || isAdmin || isGestor) && (
          <Route path="/suporte" element={<SafeRoute><SupportLayout /></SafeRoute>}>
            <Route index element={<SafeRoute><SupportDashboard /></SafeRoute>} />
            <Route path="dashboard" element={<SafeRoute><SupportDashboard /></SafeRoute>} />
            <Route path="estoque" element={<SafeRoute><SupportStock /></SafeRoute>} />
            <Route path="clientes" element={<SafeRoute><SupportClients /></SafeRoute>} />
            <Route path="os" element={<SafeRoute><SupportOrders /></SafeRoute>} />
            <Route path="os/:id" element={<SafeRoute><SupportOrderDetail /></SafeRoute>} />
            <Route path="compras" element={<SafeRoute><SupportPurchases /></SafeRoute>} />
            <Route path="orcamentos" element={<SafeRoute><SupportBudgets /></SafeRoute>} />
            <Route path="nuvem" element={<SafeRoute><SupportCloud /></SafeRoute>} />
            <Route path="relatorios" element={<SafeRoute><SupportReports /></SafeRoute>} />
            <Route path="manutencao" element={<SafeRoute><SupportMaintenance /></SafeRoute>} />
          </Route>
        )}

        {!isSupportOnly && (
          <>
            <Route path="/" element={
              isLogisticaOnly ? <RedirectPreservingSearch to="/logistics" /> :
              isFinanceiroOnly ? <RedirectPreservingSearch to="/financial" /> :
              <RedirectPreservingSearch to="/dashboard" />
            } />
            <Route path="/dashboard" element={<SafeRoute><Dashboard /></SafeRoute>} />
            <Route path="/operational" element={<SafeRoute><OperationalCenter /></SafeRoute>} />
            <Route path="/clients" element={<SafeRoute><Clients /></SafeRoute>} />
            <Route path="/quotes" element={<SafeRoute><Quotes /></SafeRoute>} />
            <Route path="/products" element={<SafeRoute><Products /></SafeRoute>} />
            <Route path="/contracts" element={<SafeRoute><ContractGenerator /></SafeRoute>} />

            <Route path="/ecoflow" element={<SafeRoute><EcoflowCalculator /></SafeRoute>} />
            <Route path="/tasks" element={<SafeRoute><Tasks /></SafeRoute>} />
            <Route path="/metrics" element={<SafeRoute><Metrics /></SafeRoute>} />
            <Route path="/pipeline" element={<SafeRoute><Pipeline /></SafeRoute>} />
            <Route path="/quote/:token" element={<SafeRoute><PublicQuote /></SafeRoute>} />
            <Route path="/negociacoes" element={<SafeRoute><Negociacoes /></SafeRoute>} />
            <Route path="/prospect" element={<SafeRoute><ProspectView /></SafeRoute>} />
            <Route path="/reports" element={<SafeRoute><Reports /></SafeRoute>} />
            <Route path="/logistics" element={<SafeRoute><Logistics /></SafeRoute>} />
            <Route path="/estoque-sc" element={<SafeRoute><EstoqueSC /></SafeRoute>} />
            {(isGestor || isFinanceiro) && <Route path="/financial" element={<SafeRoute><Financial /></SafeRoute>} />}
            {(isGestor || isFinanceiro) && <Route path="/bank-slips" element={<SafeRoute><BankSlips /></SafeRoute>} />}
            {(isAdmin || isGestor) && <Route path="/approvals" element={<SafeRoute><Approvals /></SafeRoute>} />}
            {isAdmin && <Route path="/integrations" element={<SafeRoute><Integrations /></SafeRoute>} />}
          </>
        )}

        {isSupportOnly && <Route path="/" element={<RedirectPreservingSearch to="/suporte" />} />}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <PrivacyProvider>
              <AppRoutes />
              <AppVersionBanner />
              <Toaster />
              <Sonner position="top-right" closeButton theme="light" />
              <PWAUpdatePrompt />
            </PrivacyProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
