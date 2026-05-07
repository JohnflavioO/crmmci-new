import { useAuth } from '@/hooks/useAuth';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, UserCheck, LogOut, Package, Calculator, ListChecks, BarChart3, Filter, Handshake, Plug,
  Clock, ArrowDownCircle, AlertTriangle, FileBarChart, Truck, ClipboardList, TriangleAlert, MapPin, RefreshCw, Warehouse, Target, Sparkles,
  Wrench,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import UserProfileEditor from './UserProfileEditor';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/quotes', icon: FileText, label: 'Orçamentos' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/prospect', icon: Target, label: 'Visão Prospect' },
  { to: '/pipeline', icon: Filter, label: 'Funil' },
  { to: '/negociacoes', icon: Handshake, label: 'Negociações' },
  { to: '/tasks', icon: ListChecks, label: 'Tarefas' },
  { to: '/metrics', icon: BarChart3, label: 'Métricas' },
  { to: '/products', icon: Package, label: 'Produtos' },
];

const adminGestorItems = [
  { to: '/approvals', icon: UserCheck, label: 'Usuários' },
];

const adminOnlyItems = [
  { to: '/integrations', icon: Plug, label: 'Integrações' },
];

interface Props {
  onNavigate?: () => void;
}

export default function AppSidebar({ onNavigate }: Props) {
  const { isAdmin, isGestor, isFinanceiro, isLogistica, isSupport, signOut } = useAuth();
  const location = useLocation();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshApp = useCallback(async () => {
    setRefreshing(true);
    try {
      // Clear all caches (service worker + browser caches)
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
      // Force service worker update if available
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      // Hard reload
      window.location.reload();
    } catch {
      window.location.reload();
    }
  }, []);

  const isFinanceiroOnly = isFinanceiro && !isAdmin && !isGestor;
  const isLogisticaOnly = isLogistica && !isAdmin && !isGestor && !isFinanceiro;

  const LinkItem = ({ to, icon: Icon, label, color }: { to: string; icon: any; label: string; color?: string }) => {
    const isActive = location.pathname === to;
    return (
      <NavLink
        to={to}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
        style={color && !isActive ? { color } : undefined}
      >
        <Icon className="h-5 w-5" />
        {label}
      </NavLink>
    );
  };

  const financialMenuItems = [
    { to: '/financial?tab=dashboard', icon: LayoutDashboard, label: 'Dashboard Financeiro' },
    { to: '/bank-slips', icon: FileBarChart, label: 'Controle de Boletos' },
    { to: '/financial?tab=pendencias', icon: Clock, label: 'Contas a Receber' },
    { to: '/financial?tab=baixas', icon: ArrowDownCircle, label: 'Baixas' },
    { to: '/financial?tab=pendencias&priority=vencidos', icon: AlertTriangle, label: 'Pendências' },
    { to: '/financial?tab=relatorios', icon: FileBarChart, label: 'Relatórios' },
  ];

  const logisticsMenuItems = [
    { to: '/logistics?tab=dashboard', icon: LayoutDashboard, label: 'Dashboard Logística' },
    { to: '/logistics?tab=pedidos', icon: ClipboardList, label: 'Pedidos' },
    { to: '/logistics?tab=nf', icon: FileText, label: 'NF / Emissão' },
    { to: '/logistics?tab=envios', icon: Truck, label: 'Envios' },
    { to: '/logistics?tab=rastreamento', icon: MapPin, label: 'Rastreamento' },
    { to: '/logistics?tab=problemas', icon: TriangleAlert, label: 'Problemas' },
  ];

  const FinancialLinkItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const isActive = location.pathname + location.search === to || (to === '/financial?tab=dashboard' && location.pathname === '/financial' && !location.search);
    return (
      <NavLink
        to={to}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        <Icon className="h-5 w-5" />
        {label}
      </NavLink>
    );
  };

  const LogisticsLinkItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const isActive = location.pathname + location.search === to || (to === '/logistics?tab=dashboard' && location.pathname === '/logistics' && !location.search);
    return (
      <NavLink
        to={to}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        <Icon className="h-5 w-5" />
        {label}
      </NavLink>
    );
  };

  // Logistica-only sidebar
  if (isLogisticaOnly) {
    return (
      <aside className="w-full md:w-64 h-full md:h-screen md:fixed md:left-0 md:top-0 flex flex-col border-r border-sidebar-border"
        style={{ background: 'var(--gradient-sidebar)' }}>
        <div className="p-4 flex items-center gap-3">
          <img src="/mci-logo.png" alt="MCI Store" className="h-10 w-auto" />
          <div>
            <h1 className="text-sm font-bold font-display text-sidebar-primary-foreground">MCI Store</h1>
            <p className="text-[10px] text-sidebar-foreground/60">Setor Logística</p>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {logisticsMenuItems.map(item => (
            <LogisticsLinkItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-3"><UserProfileEditor /></div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefreshApp} disabled={refreshing}
              className="flex items-center gap-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors flex-1 min-h-[44px]">
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /> Atualizar
            </button>
            <button onClick={() => { signOut(); onNavigate?.(); }}
              className="flex items-center gap-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors flex-1 min-h-[44px]">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full md:w-64 h-full md:h-screen md:fixed md:left-0 md:top-0 flex flex-col border-r border-sidebar-border"
      style={{ background: 'var(--gradient-sidebar)' }}>
      <div className="p-4 flex items-center gap-3">
        <img src="/mci-logo.png" alt="MCI Store" className="h-10 w-auto" />
        <div>
          <h1 className="text-sm font-bold font-display text-sidebar-primary-foreground">MCI Store</h1>
          <p className="text-[10px] text-sidebar-foreground/60">
            {isFinanceiroOnly ? 'Setor Financeiro' : 'Sistema de Orçamentos'}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {isFinanceiroOnly ? (
          <>
            {financialMenuItems.map(item => (
              <FinancialLinkItem key={item.to} {...item} />
            ))}
          </>
        ) : (
          <>
            {navItems.map(item => (
              <LinkItem key={item.to} {...item} color={item.to === '/quotes' ? '#15AFA1' : undefined} />
            ))}

            <LinkItem to="/ecoflow" icon={Calculator} label="Calculadora Ecoflow" />

            {/* Logistics menu for commercial users */}
            <div className="pt-4 pb-2 px-3">
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">Logística</p>
            </div>
            <LinkItem to="/logistics" icon={Truck} label="Acompanhamento" />
            <LinkItem to="/estoque-sc" icon={Warehouse} label="Estoque SC" />

            {(isGestor || isFinanceiro) && (
              <>
                <div className="pt-4 pb-2 px-3">
                  <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">Financeiro</p>
                </div>
                {financialMenuItems.map(item => (
                  <FinancialLinkItem key={item.to} {...item} />
                ))}
              </>
            )}

            {(isAdmin || isGestor) && (
              <>
                <div className="pt-4 pb-2 px-3">
                  <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">Admin</p>
                </div>
                {adminGestorItems.map(item => <LinkItem key={item.to} {...item} />)}
                {isAdmin && adminOnlyItems.map(item => <LinkItem key={item.to} {...item} />)}
              </>
            )}

            {(isSupport || isAdmin) && (
              <>
                <div className="pt-4 pb-2 px-3">
                  <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">Técnico</p>
                </div>
                <LinkItem to="/suporte" icon={Wrench} label="Suporte Técnico" />
              </>
            )}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="mb-3">
          <UserProfileEditor />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefreshApp} disabled={refreshing}
            className="flex items-center gap-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors flex-1 min-h-[44px]">
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /> Atualizar
          </button>
          <button
            onClick={() => { signOut(); onNavigate?.(); }}
            className="flex items-center gap-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors flex-1 min-h-[44px]"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
