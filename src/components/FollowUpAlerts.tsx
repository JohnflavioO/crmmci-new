import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Phone, Clock } from 'lucide-react';
import { differenceInDays } from 'date-fns';

const db = supabase as any;

interface FollowUpClient {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  last_interaction_at: string;
  daysAgo: number;
}

export default function FollowUpAlerts() {
  const { user, isGestor } = useAuth();
  const [clients, setClients] = useState<FollowUpClient[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await db.from('clients').select('id, company_name, contact_name, phone, last_interaction_at, created_by');
      if (!data) return;
      
      const now = new Date();
      const overdue = data
        .filter((c: any) => {
          if (!isGestor && c.created_by !== user?.id) return false;
          const lastDate = c.last_interaction_at ? new Date(c.last_interaction_at) : new Date(0);
          return differenceInDays(now, lastDate) >= 3;
        })
        .map((c: any) => ({
          ...c,
          daysAgo: differenceInDays(now, new Date(c.last_interaction_at || 0)),
        }))
        .sort((a: FollowUpClient, b: FollowUpClient) => b.daysAgo - a.daysAgo)
        .slice(0, 10);
      
      setClients(overdue);
    };
    load();
  }, [user, isGestor]);

  if (clients.length === 0) return null;

  const markInteraction = async (clientId: string) => {
    await db.from('clients').update({ last_interaction_at: new Date().toISOString() }).eq('id', clientId);
    setClients(prev => prev.filter(c => c.id !== clientId));
  };

  return (
    <Card className="shadow-card border-l-4 border-l-amber-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Follow-up Pendente
          <Badge variant="destructive" className="ml-auto">{clients.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">Clientes sem interação há mais de 3 dias</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {clients.map(c => (
            <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.company_name || 'Sem nome'}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{c.daysAgo} dias sem contato</span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => markInteraction(c.id)}>
                <Phone className="h-3 w-3 mr-1" /> Contatado
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
