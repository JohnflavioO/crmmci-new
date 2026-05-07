import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, Package, Users, ClipboardList, ShoppingCart, FileText,
  Cloud, BarChart3, Wrench, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { to: '/suporte', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/suporte/estoque', icon: Package, label: 'Estoque' },
  { to: '/suporte/clientes', icon: Users, label: 'Clientes' },
  { to: '/suporte/os', icon: ClipboardList, label: 'Ordens de Serviço' },
  { to: '/suporte/compras', icon: ShoppingCart, label: 'Ordem de Compra' },
  { to: '/suporte/orcamentos', icon: FileText, label: 'Orçamentos' },
  { to: '/suporte/nuvem', icon: Cloud, label: 'Nuvem' },
  { to: '/suporte/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/suporte/manutencao', icon: Wrench, label: 'Manutenção' },
];

export default function SupportSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { signOut, profile } = useAuth();
  const { pathname } = useLocation();

  return (
    <aside
      className="w-full md:w-64 h-full md:h-screen md:fixed md:left-0 md:top-0 flex flex-col border-r border-slate-100 bg-white"
    >
      <div className="p-6 flex items-center gap-3">
        <div className="bg-slate-900 p-2 rounded-xl">
          <Wrench className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold font-display text-slate-900 tracking-tight">MCI Tech</h1>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Suporte Técnico</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-2">
        {items.map(({ to, icon: Icon, label, end }) => {
          const active = end ? pathname === to : pathname === to || pathname.startsWith(to + '/');
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[40px]',
                active
                  ? 'bg-slate-50 text-slate-900 shadow-sm ring-1 ring-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-blue-600" : "text-slate-400")} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-50 space-y-4">
        {profile?.full_name && (
          <div className="px-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
              {profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{profile.full_name}</p>
              <p className="text-[10px] text-slate-500 truncate capitalize">{profile.role?.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => { signOut(); onNavigate?.(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors w-full"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </aside>
  );
}
