import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PrivacyProvider } from "@/hooks/usePrivacy";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";
import AppVersionBanner from "./components/AppVersionBanner";

import { lazy, Suspense, type ReactNode } from "react";
import { useFollowUpScanner } from "@/hooks/useFollowUpScanner";
import RouteFallback from "@/components/RouteFallback";

import Auth from "./pages/Auth";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import ForcePasswordChange from "./pages/ForcePasswordChange";
const Dashboard = lazy(() => import("./pages/Dashboard"));

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
const Help = lazy(() => import("./pages/Help"));
const About = lazy(() => import("./pages/About"));
const InteligenciaComercial = lazy(() => import("./pages/InteligenciaComercial"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const AssistenteComercial = lazy(() => import("./pages/AssistenteComercial"));
const AssistantAudit = lazy(() => import("./pages/AssistantAudit"));
const AssistantSettings = lazy(() => import("./pages/AssistantSettings"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
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

function getAppSafeSearch(search: string) {
  const params = new URLSearchParams(search);

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLovablePreview = typeof window !== 'undefined' && (
    window.self !== window.top
    || host.startsWith('id-preview--')
    || host.startsWith('preview--')
    || host.includes('-preview--')
    || host.includes('lovable.app')
    || host.endsWith('.lovableproject.com')
    || host.endsWith('.lovableproject-dev.com')
    || host.endsWith('.beta.lovable.dev')
  );

  if (!isLovablePreview) {
    params.delete('__lovable_sha');
    params.delete('__lovable_token');
    params.delete('__lovable_load_id');
  }

  const safeSearch = params.toString();
  return safeSearch ? `?${safeSearch}` : '';
}

function RedirectPreservingSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${getAppSafeSearch(location.search)}`} replace />;
}

function AppRoutes() {
  const { user, loading, isApproved, isAdmin, isGestor, isFinanceiro, isLogistica, isSupport, forcePasswordChange, profile } = useAuth();
  
  useFollowUpScanner();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Suspense fallback={<RouteFallback />}>

        <Routes>
          <Route path="/quote/:token" element={<SafeRoute><PublicQuote /></SafeRoute>} />
          <Route path="/rastreamento/os/:token" element={<SafeRoute><PublicTracking /></SafeRoute>} />
          <Route path="/rastreio/pedido/:token" element={<SafeRoute><LogisticsTracking /></SafeRoute>} />
          <Route path="/.lovable/oauth/consent" element={<SafeRoute><OAuthConsent /></SafeRoute>} />
          <Route path="*" element={<Auth />} />
        </Routes>
      </Suspense>
    );
  }

  if (forcePasswordChange) return <ForcePasswordChange />;

  // Pending approval logic
  const hasValidRole = profile?.role && ['admin', 'gestor', 'vendedor', 'comercial', 'financeiro', 'logistica', 'support_tech', 'support_manager'].includes(profile.role.toLowerCase());
  const hasAnyRoleFlag = isAdmin || isGestor || isFinanceiro || isLogistica || isSupport;

  // Guard: if we're logged in but profile hasn't loaded yet AND we don't have any role/approval signal,
  // treat as still-loading instead of "pending". This avoids the false "Aguardando aprovação" screen
  // when the profile fetch was slow or transiently failed.
  if (user && !profile && !hasAnyRoleFlag && !isApproved) {
    return <LoadingScreen />;
  }

  const isPending = !hasAnyRoleFlag && !isApproved && !hasValidRole;

  if (isPending) return <PendingApproval />;

  const isLogisticaOnly = isLogistica && !isAdmin && !isGestor && !isFinanceiro;
  const isFinanceiroOnly = isFinanceiro && !isGestor && !isAdmin;
  const isSupportOnly = isSupport && !isAdmin && !isGestor && !isFinanceiro && !isLogistica;

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/rastreamento/os/:token" element={<SafeRoute><PublicTracking /></SafeRoute>} />
        <Route path="/rastreio/pedido/:token" element={<SafeRoute><LogisticsTracking /></SafeRoute>} />
        <Route path="/ajuda" element={<SafeRoute><Help /></SafeRoute>} />
        <Route path="/sobre" element={<SafeRoute><About /></SafeRoute>} />
        <Route path="/configuracoes/notificacoes" element={<SafeRoute><NotificationSettings /></SafeRoute>} />
        <Route path="/.lovable/oauth/consent" element={<SafeRoute><OAuthConsent /></SafeRoute>} />


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
            <Route path="/inteligencia" element={<SafeRoute><InteligenciaComercial /></SafeRoute>} />
            <Route path="/products" element={<SafeRoute><Products /></SafeRoute>} />
            <Route path="/contracts" element={<SafeRoute><ContractGenerator /></SafeRoute>} />
            <Route path="/assistente" element={<SafeRoute><AssistenteComercial /></SafeRoute>} />
            <Route path="/assistente/auditoria" element={<SafeRoute><AssistantAudit /></SafeRoute>} />

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
              <NotificationsProvider>
                <AppRoutes />
                <AppVersionBanner />

                <Toaster />
                <Sonner position="bottom-right" closeButton theme="light" richColors />
                <PWAUpdatePrompt />
              </NotificationsProvider>
            </PrivacyProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
