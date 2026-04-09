import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading, isApproved, isAdmin, isGestor, isFinanceiro } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/quote/:token" element={<PublicQuote />} />
        <Route path="*" element={<Auth />} />
      </Routes>
    );
  }
  if (!isApproved) return <PendingApproval />;

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/clients" element={<Clients />} />
      <Route path="/quotes" element={<Quotes />} />
      <Route path="/products" element={<Products />} />
      <Route path="/ecoflow" element={<EcoflowCalculator />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/metrics" element={<Metrics />} />
      <Route path="/pipeline" element={<Pipeline />} />
      <Route path="/quote/:token" element={<PublicQuote />} />
      <Route path="/negociacoes" element={<Negociacoes />} />
        <Route path="/reports" element={<Reports />} />
        {(isGestor || isFinanceiro) && <Route path="/financial" element={<Financial />} />}
        {(isAdmin || isGestor) && <Route path="/approvals" element={<Approvals />} />}
        {isAdmin && <Route path="/integrations" element={<Integrations />} />}
        <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
