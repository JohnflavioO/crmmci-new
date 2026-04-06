import { useAuth } from '@/hooks/useAuth';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, UserCheck, LogOut, Package, Calculator, ListChecks, BarChart3, Filter, Handshake,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import UserProfileEditor from './UserProfileEditor';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/quotes', icon: FileText, label: 'Orçamentos' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/pipeline', icon: Filter, label: 'Funil' },
  { to: '/negociacoes', icon: Handshake, label: 'Negociações' },
  { to: '/tasks', icon: ListChecks, label: 'Tarefas' },
  { to: '/metrics', icon: BarChart3, label: 'Métricas' },
  { to: '/products', icon: Package, label: 'Produtos' },
];

const adminItems = [
  { to: '/approvals', icon: UserCheck, label: 'Usuários' },
];

interface Props {
  onNavigate?: () => void;
}

export default function AppSidebar({ onNavigate }: Props) {
  const { profile, isAdmin, isGestor, signOut } = useAuth();
  const location = useLocation();

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

  return (
    <aside className="w-full md:w-64 h-full md:h-screen md:fixed md:left-0 md:top-0 flex flex-col border-r border-sidebar-border"
      style={{ background: 'var(--gradient-sidebar)' }}>
      <div className="p-4 flex items-center gap-3">
        <img src="/mci-logo.png" alt="MCI Store" className="h-10 w-auto" />
        <div>
          <h1 className="text-sm font-bold font-display text-sidebar-primary-foreground">MCI Store</h1>
          <p className="text-[10px] text-sidebar-foreground/60">Sistema de Orçamentos</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <LinkItem key={item.to} {...item} color={item.to === '/quotes' ? '#15AFA1' : undefined} />
        ))}

        <LinkItem to="/ecoflow" icon={Calculator} label="Calculadora Ecoflow" />

        {(isAdmin || isGestor) && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">Admin</p>
            </div>
            {adminItems.map(item => <LinkItem key={item.to} {...item} />)}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="mb-3">
          <UserProfileEditor />
        </div>
        <button
          onClick={() => { signOut(); onNavigate?.(); }}
          className="flex items-center gap-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors w-full min-h-[44px]"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </aside>
  );
}
