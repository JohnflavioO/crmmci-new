import { ReactNode, useState } from 'react';
import AppSidebar from './AppSidebar';
import NotificationBell from './NotificationBell';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

export default function AppLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-background border-b border-border">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors" aria-label="Menu">
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72" aria-describedby={undefined}>
              <AppSidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <img src="/mci-logo.png" alt="MCI Store" className="h-8 w-auto" />
          <span className="text-sm font-bold font-display flex-1">MCI Store</span>
          <NotificationBell />
        </header>
        <main className="p-4 pb-20 animate-fade-in">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-64">
        <header className="sticky top-0 z-40 flex items-center justify-end px-6 py-2 bg-background/80 backdrop-blur border-b border-border">
          <NotificationBell />
        </header>
        <main className="p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
