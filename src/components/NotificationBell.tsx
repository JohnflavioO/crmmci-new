import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, X, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { requestNotificationPermission } from '@/lib/firebase';
import { toast } from 'sonner';

const db = supabase as any;

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_quote_id?: string;
  related_client_id?: string;
}

export default function NotificationBell() {
  const { user, isAdmin, isGestor } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState('Notification' in window && Notification.permission === 'granted');

  const canSee = isAdmin || isGestor;

  const fetchNotifications = useCallback(async () => {
    if (!user || !canSee) return;
    const { data } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
  }, [user, canSee]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !canSee) return;
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, canSee, fetchNotifications]);

  if (!canSee) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await db.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    await db.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const deleteNotification = async (id: string) => {
    await db.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const typeColor: Record<string, string> = {
    quote_status: 'bg-blue-100 border-blue-200',
    new_client: 'bg-emerald-100 border-emerald-200',
    followup: 'bg-amber-100 border-amber-200',
    info: 'bg-muted',
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="relative p-2 rounded-full hover:bg-muted transition-colors" aria-label="Notificações">
          <Bell className="h-5 w-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-destructive rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-96 p-0 flex flex-col" aria-describedby={undefined}>
        <SheetHeader className="p-4 pb-2 border-b border-border">
          <SheetTitle className="text-lg font-bold">Notificações</SheetTitle>
        </SheetHeader>

        {unreadCount > 0 && (
          <div className="px-4 py-2">
            <Button size="sm" variant="default" className="w-full" onClick={markAllRead}>
              <Check className="h-4 w-4 mr-2" /> Marcar todas como lidas
            </Button>
          </div>
        )}

        <div className="px-4 py-2 text-sm text-muted-foreground flex items-center justify-between">
          <span>{unreadCount > 0 ? `${unreadCount} notificação(ões) nova(s)` : 'Nenhuma notificação nova'}</span>
          {!isPushEnabled && 'Notification' in window && (
            <Button variant="ghost" size="sm" onClick={handleEnablePush} className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
              <ShieldCheck className="h-3 w-3" /> Ativar Push
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 px-4 pb-4">
          <div className="space-y-2">
            {notifications.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Sem notificações</p>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                className={`relative p-3 rounded-lg border transition-colors cursor-pointer ${
                  n.is_read ? 'bg-muted/30 border-border opacity-70' : (typeColor[n.type] || 'bg-accent/50 border-accent')
                }`}
                onClick={() => {
                  if (n.related_quote_id) {
                    window.location.href = `/quotes?id=${n.related_quote_id}`;
                  }
                }}
              >
                <button
                  onClick={() => deleteNotification(n.id)}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-muted/80 transition-colors"
                  aria-label="Remover"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="absolute top-2 right-8 p-1 rounded hover:bg-muted/80 transition-colors"
                    aria-label="Marcar como lida"
                  >
                    <Check className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
                <p className="text-sm font-semibold pr-14">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
