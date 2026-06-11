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

// Eager imports for stability
import Auth from "./pages/Auth";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import Dashboard from "./pages/Dashboard";

// Lazy routes
const OperationalCenter = lazy(() => import("./pages/OperationalCenter"));
const Clients = lazy(() => import("./pages/Clients"));
const Quotes = lazy(() => import("./pages/Quotes"));
const Approvals = lazy(() => import("./pages/Approvals"));
const Products = lazy(() => import("./pages/Products"));
const EcoflowCalculator = lazy(() => import("./pages/EcoflowCalculator"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Metrics = lazy(() => import("./pages/Metrics"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Reports = lazy(() => import("./pages/Reports"));
const PublicQuote = lazy(() => import("./pages/PublicQuote"));
const Negociacoes = lazy(() => import("./pages/Negociacoes"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Financial = lazy(() => import("./pages/Financial"));
const Logistics = lazy(() => import("./pages/Logistics"));
const EstoqueSC = lazy(() => import("./pages/EstoqueSC"));
const ProspectView = lazy(() => import("./pages/ProspectView"));
const BankSlips = lazy(() => import("./pages/BankSlips"));
const SupportLayout = lazy(() => import("./components/support/SupportLayout"));
const SupportDashboard = lazy(() => import("./pages/support/SupportDashboard"));
const SupportClients = lazy(() => import("./pages/support/SupportClients"));
const SupportStock = lazy(() => import("./pages/support/SupportStock"));
const SupportOrders = lazy(() => import("./pages/support/SupportOrders"));
const SupportOrderDetail = lazy(() => import("./pages/support/SupportOrderDetail"));
const SupportPurchases = lazy(() => import("./pages/support/SupportPurchases"));
const SupportBudgets = lazy(() => import("./pages/support/SupportBudgets"));
const SupportCloud = lazy(() => import("./pages/support/SupportCloud"));
const SupportReports = lazy(() => import("./pages/support/SupportReports"));
const SupportMaintenance = lazy(() => import("./pages/support/SupportMaintenance"));
const PublicTracking = lazy(() => import("./pages/support/PublicTracking"));
const LogisticsTracking = lazy(() => import("./pages/LogisticsTracking"));
const ContractGenerator = lazy(() => import("./pages/ContractGenerator"));


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

function AppRoutes() {
  const { user, loading, isApproved, isAdmin, isGestor, isFinanceiro, isLogistica, isSupport, forcePasswordChange, profile } = useAuth();
  
  useFollowUpScanner();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/quote/:token" element={<PublicQuote />} />
          <Route path="/rastreamento/os/:token" element={<PublicTracking />} />
          <Route path="/rastreio/pedido/:token" element={<LogisticsTracking />} />
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
        <Route path="/rastreamento/os/:token" element={<PublicTracking />} />
        <Route path="/rastreio/pedido/:token" element={<LogisticsTracking />} />

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

        {!isSupportOnly && (
          <>
            <Route path="/" element={
              isLogisticaOnly ? <Navigate to="/logistics" replace /> :
              isFinanceiroOnly ? <Navigate to="/financial" replace /> :
              <Navigate to="/dashboard" replace />
            } />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/operational" element={<OperationalCenter />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/products" element={<Products />} />
            <Route path="/contracts" element={<ContractGenerator />} />

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

        {isSupportOnly && <Route path="/" element={<Navigate to="/suporte" replace />} />}
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
