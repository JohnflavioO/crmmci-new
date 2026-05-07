import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import SupportSidebar from './SupportSidebar';
import { cn } from '@/lib/utils';

export default function SupportLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <SupportSidebar />
      </div>

      {/* Mobile drawer */}
      <div className={cn(
        'md:hidden fixed inset-0 z-50 transition-opacity',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
        <div className="absolute left-0 top-0 h-full w-64 bg-sidebar">
          <SupportSidebar onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        <header className="md:hidden h-12 flex items-center border-b px-3">
          <button onClick={() => setOpen(v => !v)} className="p-2">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="ml-2 font-semibold">Suporte Técnico</span>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
