import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { GripVertical, Phone } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const db = supabase as any;

const STAGES = [
  { key: 'lead', label: 'Lead', color: 'bg-slate-500' },
  { key: 'contato_feito', label: 'Contato Feito', color: 'bg-blue-500' },
  { key: 'proposta_enviada', label: 'Proposta Enviada', color: 'bg-amber-500' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-purple-500' },
  { key: 'fechado', label: 'Fechado', color: 'bg-emerald-500' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface PipelineClient {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  pipeline_stage: string;
  last_interaction_at: string;
  created_by: string;
  totalQuotes: number;
  totalValue: number;
}

export default function Pipeline() {
  useAuth();
  const isMobile = useIsMobile();
  const [clients, setClients] = useState<PipelineClient[]>([]);
  const [draggedClient, setDraggedClient] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data: clientsData } = await db.from('clients').select('id, company_name, contact_name, phone, email, pipeline_stage, last_interaction_at, created_by');
    const { data: quotesData } = await db.from('quotes').select('client_id, total_amount, status');

    const quotesByClient: Record<string, { count: number; total: number }> = {};
    (quotesData || []).forEach((q: any) => {
      if (!q.client_id) return;
      if (!quotesByClient[q.client_id]) quotesByClient[q.client_id] = { count: 0, total: 0 };
      quotesByClient[q.client_id].count++;
      quotesByClient[q.client_id].total += parseFloat(q.total_amount) || 0;
    });

    setClients((clientsData || []).map((c: any) => ({
      ...c,
      totalQuotes: quotesByClient[c.id]?.count || 0,
      totalValue: quotesByClient[c.id]?.total || 0,
    })));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const moveClient = async (clientId: string, newStage: string) => {
    const { error } = await db.from('clients').update({ 
      pipeline_stage: newStage,
      last_interaction_at: new Date().toISOString()
    }).eq('id', clientId);
    if (error) { toast.error('Erro ao mover cliente'); return; }
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, pipeline_stage: newStage, last_interaction_at: new Date().toISOString() } : c));
    toast.success('Cliente movido com sucesso');
  };

  const handleDragStart = (clientId: string) => setDraggedClient(clientId);
  const handleDragOver = (e: React.DragEvent, stage: string) => { e.preventDefault(); setDragOverStage(stage); };
  const handleDragLeave = () => setDragOverStage(null);
  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedClient) { moveClient(draggedClient, stage); setDraggedClient(null); }
  };

  const getStageClients = (stage: string) => clients.filter(c => (c.pipeline_stage || 'lead') === stage);
  const getStageValue = (stage: string) => getStageClients(stage).reduce((s, c) => s + c.totalValue, 0);

  const renderClientCard = (client: PipelineClient, stageIdx: number) => (
    <div
      key={client.id}
      draggable
      onDragStart={() => handleDragStart(client.id)}
      className="p-3 rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{client.company_name || 'Sem nome'}</p>
          {client.contact_name && <p className="text-xs text-muted-foreground truncate">{client.contact_name}</p>}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {client.totalValue > 0 && (
              <span className="text-xs font-medium text-primary">{formatCurrency(client.totalValue)}</span>
            )}
            {client.totalQuotes > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{client.totalQuotes} orç.</Badge>
            )}
          </div>
          {client.phone && (
            <div className="flex items-center gap-1 mt-1">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{client.phone}</span>
            </div>
          )}
        </div>
      </div>
      {/* Mobile move buttons */}
      {isMobile && (
        <div className="flex gap-1 mt-2">
          {stageIdx > 0 && (
            <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => moveClient(client.id, STAGES[stageIdx - 1].key)}>
              ← {STAGES[stageIdx - 1].label}
            </Button>
          )}
          {stageIdx < STAGES.length - 1 && (
            <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => moveClient(client.id, STAGES[stageIdx + 1].key)}>
              {STAGES[stageIdx + 1].label} →
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold font-display">Funil de Vendas</h1>
        <p className="text-muted-foreground text-sm">Arraste clientes entre as etapas do funil</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {STAGES.map(stage => {
          const stageClients = getStageClients(stage.key);
          return (
            <div key={stage.key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <div className={`w-2 h-2 rounded-full ${stage.color}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{stage.label}</p>
                <p className="text-[10px] text-muted-foreground">{stageClients.length} · {formatCurrency(getStageValue(stage.key))}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className={isMobile ? 'space-y-4' : 'flex gap-3 overflow-x-auto pb-4'}>
        {STAGES.map((stage, stageIdx) => {
          const stageClients = getStageClients(stage.key);
          return (
            <div
              key={stage.key}
              className={`${isMobile ? '' : 'min-w-[240px] w-[240px]'} flex-shrink-0`}
              onDragOver={e => handleDragOver(e, stage.key)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, stage.key)}
            >
              <div className={`rounded-xl border ${dragOverStage === stage.key ? 'border-primary bg-primary/5' : 'bg-muted/30'} p-3 min-h-[200px]`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                  <h3 className="text-sm font-semibold">{stage.label}</h3>
                  <Badge variant="secondary" className="ml-auto text-[10px]">{stageClients.length}</Badge>
                </div>
                <div className="space-y-2">
                  {stageClients.map(c => renderClientCard(c, stageIdx))}
                  {stageClients.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">Nenhum cliente</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
