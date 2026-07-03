import { useAuth } from '@/hooks/useAuth';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, UserCheck, LogOut, Package, Calculator, ListChecks, BarChart3, Filter, Handshake, Plug,
  Clock, ArrowDownCircle, AlertTriangle, FileBarChart, Truck, ClipboardList, TriangleAlert, MapPin, RefreshCw, Warehouse, Target, Sparkles,
  Wrench, Zap, HelpCircle, Brain
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import UserProfileEditor from './UserProfileEditor';
import SidebarVersion from './SidebarVersion';
import { usePermissions } from '@/hooks/usePermissions';
import { prefetchRoute } from '@/lib/routePrefetch';


const commercialItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Métricas e Visão' },
  { to: '/quotes', icon: FileText, label: 'Orçamentos', color: '#15AFA1' },
  
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/products', icon: Package, label: 'Produtos' },
  { to: '/pipeline', icon: Filter, label: 'Funil' },
  { to: '/negociacoes', icon: Handshake, label: 'Negociações' },
  { to: '/tasks', icon: ListChecks, label: 'Tarefas' },
];

const analyticItems = [
  { to: '/metrics', icon: BarChart3, label: 'Métricas' },
  { to: '/inteligencia', icon: Brain, label: 'Inteligência Comercial' },
  { to: '/prospect', icon: Target, label: 'Visão Prospect' },
  { to: '/ecoflow', icon: Calculator, label: 'Calculadora Ecoflow' },
];

const toolItems = [
  { to: '/contracts', icon: FileText, label: 'Gerador de Contrato' },
];


const supportMenuItems = [
  { to: '/suporte', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/suporte/os', icon: ClipboardList, label: 'Ordens de Serviço' },
  { to: '/suporte/orcamentos', icon: Calculator, label: 'Orçamentos' },
  { to: '/suporte/clientes', icon: Users, label: 'Clientes' },
  { to: '/suporte/estoque', icon: Warehouse, label: 'Estoque' },
  { to: '/suporte/compras', icon: Truck, label: 'Ordem de Compra' },
  { to: '/suporte/nuvem', icon: Sparkles, label: 'Nuvem' },
  { to: '/suporte/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/suporte/manutencao', icon: Wrench, label: 'Manutenção' },
];

interface Props {
  onNavigate?: () => void;
}

export default function AppSidebar({ onNavigate }: Props) {
  const { isAdmin, isGestor, isFinanceiro, isLogistica, isSupport, isSupportTech, isSupportManager, signOut } = useAuth();
  const { hasPermission } = usePermissions();

  const location = useLocation();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshApp = useCallback(async () => {
    setRefreshing(true);
    const host = window.location.hostname;
    const isPreview = window.self !== window.top
      || host.startsWith('id-preview--')
      || host.includes('-preview--')
      || host.includes('lovable.app')
      || host.endsWith('.lovableproject.com');

    try {
      if (!isPreview) {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n)));
        }

        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) {
          await reg.unregister();
        }
      }

      if (isPreview) {
        window.history.replaceState(window.history.state, '', window.location.href);
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
      }

      window.location.reload();
    } catch {
      if (isPreview) return;
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
        onMouseEnter={() => prefetchRoute(to)}
        onFocus={() => prefetchRoute(to)}
        onTouchStart={() => prefetchRoute(to)}
        className={cn(
          'group relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ease-out min-h-[36px]',
          isActive
            ? 'text-sidebar-accent-foreground bg-sidebar-accent/25 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-sidebar-primary'
            : 'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/25 hover:translate-x-[2px]'
        )}
        style={color && !isActive ? { color } : undefined}
      >
        <Icon className={cn('h-[18px] w-[18px] shrink-0 transition-colors', isActive && 'text-sidebar-primary')} />
        <span className="truncate">{label}</span>
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
        onMouseEnter={() => prefetchRoute(to)}
        onFocus={() => prefetchRoute(to)}
        onTouchStart={() => prefetchRoute(to)}
        className={cn(
          'relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ease-out min-h-[36px]',
          isActive
            ? 'text-sidebar-accent-foreground bg-sidebar-accent/25 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-sidebar-primary'
            : 'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/25 hover:translate-x-[2px]'
        )}
      >
        <Icon className={cn('h-[18px] w-[18px] shrink-0 transition-colors', isActive && 'text-sidebar-primary')} />
        <span className="truncate">{label}</span>
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
          'relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ease-out min-h-[36px]',
          isActive
            ? 'text-sidebar-accent-foreground bg-sidebar-accent/25 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-sidebar-primary'
            : 'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/25 hover:translate-x-[2px]'
        )}
      >
        <Icon className={cn('h-[18px] w-[18px] shrink-0 transition-colors', isActive && 'text-sidebar-primary')} />
        <span className="truncate">{label}</span>
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
          <LinkItem to="/ajuda" icon={HelpCircle} label="Ajuda" />
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
          <SidebarVersion />
        </div>
      </aside>
    );
  }

  const isSupportOnly = isSupport && !isAdmin && !isGestor && !isFinanceiro && !isLogistica;

  if (isSupportOnly) {
    return (
      <aside className="w-full md:w-64 h-full md:h-screen md:fixed md:left-0 md:top-0 flex flex-col border-r border-sidebar-border"
        style={{ background: 'var(--gradient-sidebar)' }}>
        <div className="p-4 flex items-center gap-3">
          <img src="/mci-logo.png" alt="MCI Store" className="h-10 w-auto" />
          <div>
            <h1 className="text-sm font-bold font-display text-sidebar-primary-foreground">MCI Store</h1>
            <p className="text-[10px] text-sidebar-foreground/60">Suporte Técnico</p>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {supportMenuItems.map(item => (
            <LinkItem key={item.to} {...item} />
          ))}
          <LinkItem to="/ajuda" icon={HelpCircle} label="Ajuda" />
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
          <SidebarVersion />
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
            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-[0.1em]">Ajuda</p>
            </div>
            <LinkItem to="/ajuda" icon={HelpCircle} label="Tutoriais" />
          </>
        ) : (
          <>
            <div className="pt-2 pb-1 px-3">
              <p className="text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-[0.1em]">Comercial</p>
            </div>
            {commercialItems.map(item => (
              <LinkItem key={item.to} {...item} color={item.color} />
            ))}

            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-[0.1em]">Análise e Ferramentas</p>
            </div>
            {analyticItems.map(item => (
              <LinkItem key={item.to} {...item} />
            ))}

            {hasPermission('contracts.use') && (
              <>
                <div className="pt-4 pb-1 px-3">
                  <p className="text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-[0.1em]">Ferramentas</p>
                </div>
                {toolItems.map(item => (
                  <LinkItem key={item.to} {...item} />
                ))}
              </>
            )}



            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-[0.1em]">Operacional e Logística</p>
            </div>
            <LinkItem to="/logistics" icon={Truck} label="Acompanhamento" />
            <LinkItem to="/estoque-sc" icon={Warehouse} label="Estoque SC" />

            {(isGestor || isFinanceiro) && (
              <>
                <div className="pt-4 pb-1 px-3">
                  <p className="text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-[0.1em]">Financeiro</p>
                </div>
                {financialMenuItems.map(item => (
                  <FinancialLinkItem key={item.to} {...item} />
                ))}
              </>
            )}

            {(isAdmin || isGestor) && (
              <>
                <div className="pt-4 pb-1 px-3">
                  <p className="text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-[0.1em]">Administrativo</p>
                </div>
                {[{ to: '/approvals', icon: UserCheck, label: 'Aprovações' }].map(item => <LinkItem key={item.to} {...item} />)}
                {isAdmin && [{ to: '/integrations', icon: Plug, label: 'Integrações' }].map(item => <LinkItem key={item.to} {...item} />)}
              </>
            )}

            {(isSupport || isAdmin || isGestor) && (
              <>
                <div className="pt-4 pb-1 px-3">
                  <p className="text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-[0.1em]">Suporte Técnico</p>
                </div>
                <LinkItem to="/suporte" icon={Wrench} label="Portal de Suporte" />
              </>
            )}

            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-[0.1em]">Ajuda</p>
            </div>
            <LinkItem to="/ajuda" icon={HelpCircle} label="Tutoriais" />
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
        <SidebarVersion />
      </div>
    </aside>
  );
}
