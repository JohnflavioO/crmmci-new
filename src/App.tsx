import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ErrorBoundary";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";
import DiagnosticErrorBoundary from "./components/DiagnosticErrorBoundary";
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
import { useState, useEffect } from "react";
import { RefreshCw, AlertTriangle, Target } from "lucide-react";
import { useFollowUpScanner } from "@/hooks/useFollowUpScanner";
import ProspectView from "./pages/ProspectView";

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
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground animate-pulse">Carregando sistema...</p>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, isApproved, isAdmin, isGestor, isFinanceiro, isLogistica, forcePasswordChange } = useAuth();
  useFollowUpScanner();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Routes>
        <Route path="/quote/:token" element={<PublicQuote />} />
        <Route path="*" element={<Auth />} />
      </Routes>
    );
  }

  // Se chegou aqui, temos usuário e terminou de carregar o perfil
  if (!isApproved) return <PendingApproval />;
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
      {(isAdmin || isGestor) && <Route path="/approvals" element={<Approvals />} />}
      {isAdmin && <Route path="/integrations" element={<Integrations />} />}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <DiagnosticErrorBoundary>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PWAUpdatePrompt />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </DiagnosticErrorBoundary>
);

export default App;
