import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Phone, Clock, MessageSquare, Sparkles } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import FollowUpGeneratorModal from './FollowUpGeneratorModal';

const db = supabase as any;

interface FollowUpClient {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  last_interaction_at: string;
  pipeline_stage: string;
  daysAgo: number;
  quoteValue: number;
  quoteNumber: string;
  quoteStatus: string;
}

export default function FollowUpAlerts() {
  const { user, isGestor, profile } = useAuth();
  const [clients, setClients] = useState<FollowUpClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<FollowUpClient | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Load clients
      const { data: clientsData } = await db.from('clients').select('id, company_name, contact_name, phone, last_interaction_at, created_by, pipeline_stage');
      if (!clientsData) return;

      // Load latest quotes per client for context
      const { data: quotesData } = await db.from('quotes').select('client_id, total_amount, quote_number, status').order('created_at', { ascending: false });

      const quotesMap: Record<string, { total_amount: number; quote_number: string; status: string }> = {};
      (quotesData || []).forEach((q: any) => {
        if (q.client_id && !quotesMap[q.client_id]) {
          quotesMap[q.client_id] = {
            total_amount: parseFloat(q.total_amount) || 0,
            quote_number: q.quote_number || '',
            status: q.status || 'draft',
          };
        }
      });

      const now = new Date();
      const overdue = clientsData
        .filter((c: any) => {
          if (!isGestor && c.created_by !== user?.id) return false;
          const lastDate = c.last_interaction_at ? new Date(c.last_interaction_at) : new Date(0);
          return differenceInDays(now, lastDate) >= 3;
        })
        .map((c: any) => {
          const quote = quotesMap[c.id];
          return {
            ...c,
            daysAgo: differenceInDays(now, new Date(c.last_interaction_at || 0)),
            pipeline_stage: c.pipeline_stage || 'lead',
            quoteValue: quote?.total_amount || 0,
            quoteNumber: quote?.quote_number || '',
            quoteStatus: quote?.status || '',
          };
        })
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

  const openFollowUp = (client: FollowUpClient) => {
    setSelectedClient(client);
    setModalOpen(true);
  };

  const getUrgencyBadge = (days: number) => {
    if (days >= 15) return <Badge variant="destructive" className="text-[10px]">Crítico</Badge>;
    if (days >= 7) return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px]">Urgente</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">Atenção</Badge>;
  };

  return (
    <>
      <Card className="shadow-card border-l-4 border-l-amber-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Follow-up Inteligente
            <Badge variant="destructive" className="ml-auto">{clients.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Clientes sem interação — com sugestões contextuais</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {clients.map(c => (
              <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{c.company_name || 'Sem nome'}</p>
                    {getUrgencyBadge(c.daysAgo)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Clock className="h-3 w-3" />
                    <span>{c.daysAgo} dias sem contato</span>
                    {c.quoteNumber && <span className="text-primary/70">• {c.quoteNumber}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => openFollowUp(c)} title="Gerar follow-up inteligente">
                    <Sparkles className="h-3 w-3 mr-1 text-amber-500" /> Follow-up
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => markInteraction(c.id)} title="Marcar como contatado">
                    <Phone className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <FollowUpGeneratorModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          client={selectedClient}
          sellerName={profile?.full_name || 'Vendedor'}
          onMarkContacted={() => {
            markInteraction(selectedClient.id);
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}
