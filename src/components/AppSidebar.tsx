import { useAuth } from '@/hooks/useAuth';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, UserCheck, LogOut, Package, Calculator, ListChecks, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/quotes', icon: FileText, label: 'Orçamentos' },
  { to: '/tasks', icon: ListChecks, label: 'Tarefas' },
  { to: '/metrics', icon: BarChart3, label: 'Métricas' },
  { to: '/products', icon: Package, label: 'Produtos' },
];

const adminItems = [
  { to: '/approvals', icon: UserCheck, label: 'Aprovações' },
];

export default function AppSidebar() {
  const { profile, isAdmin, isGestor, signOut } = useAuth();
  const location = useLocation();

  const LinkItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const isActive = location.pathname === to;
    return (
      <NavLink
        to={to}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
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

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 flex flex-col border-r border-sidebar-border"
      style={{ background: 'var(--gradient-sidebar)' }}>
      <div className="p-4 flex items-center gap-3">
        <img src="/mci-logo.png" alt="MCI Store" className="h-10 w-auto" />
        <div>
          <h1 className="text-sm font-bold font-display text-sidebar-primary-foreground">MCI Store</h1>
          <p className="text-[10px] text-sidebar-foreground/60">Sistema de Orçamentos</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(item => <LinkItem key={item.to} {...item} />)}

        {/* Calculadora Ecoflow - internal route */}
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
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-bold">
            {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || 'Usuário'}</p>
            <p className="text-xs text-sidebar-foreground/50">{profile?.role || 'comercial'}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors w-full"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </aside>
  );
}
