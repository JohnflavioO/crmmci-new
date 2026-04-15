import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { GripVertical, FileText, Users, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const db = supabase as any;

const STAGES = [
  { key: 'pre_venda', label: 'Pré-venda', color: 'bg-sky-500' },
  { key: 'contato_feito', label: 'Contato Feito', color: 'bg-blue-500' },
  { key: 'sent', label: 'Proposta Enviada', color: 'bg-amber-500' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-purple-500' },
  { key: 'approved', label: 'Fechado', color: 'bg-emerald-500' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface PipelineQuote {
  id: string;
  quote_number: string;
  client_name: string;
  status: string;
  total_amount: number;
  shipping_cost: number;
  created_at: string;
  created_by: string | null;
  salesperson: string | null;
}

interface SellerProfile {
  user_id: string;
  full_name: string;
}

export default function Pipeline() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [quotes, setQuotes] = useState<PipelineQuote[]>([]);
  const [draggedQuote, setDraggedQuote] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const sellers: SellerProfile[] = [];
  const selectedSellers: string[] = [];
  const compareMode = false;

  const loadData = useCallback(async () => {
    const { data } = await db.from('quotes')
      .select('id, quote_number, client_name, status, total_amount, shipping_cost, created_at, created_by, salesperson, clients(name, company_name)')
      .eq('created_by', user?.id);
    const mapped = (data || [])
      .filter((q: any) => q.status && q.status !== 'draft' && q.status !== 'rejected')
      .map((q: any) => ({
        ...q,
        client_name: q.clients?.company_name || q.clients?.name || q.client_name || '',
      }));
    setQuotes(mapped);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const moveQuote = async (quoteId: string, newStatus: string) => {
    const { error } = await db.from('quotes').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', quoteId);
    if (error) { toast.error('Erro ao mover orçamento'); return; }
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: newStatus } : q));
    toast.success('Orçamento movido com sucesso');
  };

  const handleDragStart = (id: string) => setDraggedQuote(id);
  const handleDragOver = (e: React.DragEvent, stage: string) => { e.preventDefault(); setDragOverStage(stage); };
  const handleDragLeave = () => setDragOverStage(null);
  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedQuote) { moveQuote(draggedQuote, stage); setDraggedQuote(null); }
  };

  const toggleSeller = (userId: string) => {
    setSelectedSellers(prev => {
      if (prev.includes(userId)) return prev.filter(id => id !== userId);
      if (prev.length >= 3) { toast.info('Máximo de 3 vendedores para comparação'); return prev; }
      return [...prev, userId];
    });
  };

  const getQuotesForSeller = (sellerId: string) =>
    quotes.filter(q => q.created_by === sellerId);

  const getStageQuotes = (stage: string, filterQuotes?: PipelineQuote[]) =>
    (filterQuotes || quotes).filter(q => q.status === stage);

  const getStageValue = (stage: string, filterQuotes?: PipelineQuote[]) =>
    getStageQuotes(stage, filterQuotes).reduce((s, q) => s + (parseFloat(String(q.total_amount)) || 0), 0);

  const getTotalValue = (filterQuotes: PipelineQuote[]) =>
    filterQuotes.reduce((s, q) => s + (parseFloat(String(q.total_amount)) || 0), 0);

  const renderQuoteCard = (quote: PipelineQuote, stageIdx: number) => (
    <div
      key={quote.id}
      draggable
      onDragStart={() => handleDragStart(quote.id)}
      className="p-3 rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="font-medium text-sm truncate">{quote.quote_number}</p>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{quote.client_name || 'Sem cliente'}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {quote.total_amount > 0 && (
              <span className="text-xs font-medium text-primary">{formatCurrency(parseFloat(String(quote.total_amount)))}</span>
            )}
          </div>
        </div>
      </div>
      {isMobile && (
        <div className="flex gap-1 mt-2">
          {stageIdx > 0 && (
            <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => moveQuote(quote.id, STAGES[stageIdx - 1].key)}>
              ← {STAGES[stageIdx - 1].label}
            </Button>
          )}
          {stageIdx < STAGES.length - 1 && (
            <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => moveQuote(quote.id, STAGES[stageIdx + 1].key)}>
              {STAGES[stageIdx + 1].label} →
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const renderSellerComparison = () => {
    const sellerData = selectedSellers.map(sid => {
      const seller = sellers.find(s => s.user_id === sid);
      const sellerQuotes = getQuotesForSeller(sid);
      return { seller, quotes: sellerQuotes };
    });

    const colWidth = selectedSellers.length === 1 ? 'w-full' : selectedSellers.length === 2 ? 'w-1/2' : 'w-1/3';

    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold">Comparativo de Vendedores</h2>
          <Button size="sm" variant="ghost" onClick={() => { setCompareMode(false); setSelectedSellers([]); }}>
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
        </div>

        <div className={`flex gap-4 ${isMobile ? 'flex-col' : ''} overflow-x-auto pb-4`}>
          {sellerData.map(({ seller, quotes: sq }) => (
            <div key={seller?.user_id} className={`${isMobile ? 'w-full' : colWidth} flex-shrink-0 min-w-[300px]`}>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{seller?.full_name || 'Vendedor'}</p>
                    <p className="text-xs text-muted-foreground">{sq.length} orçamentos · {formatCurrency(getTotalValue(sq))}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {STAGES.map(stage => {
                    const stageQ = getStageQuotes(stage.key, sq);
                    const stageV = getStageValue(stage.key, sq);
                    return (
                      <div key={stage.key} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                          <span className="text-xs font-medium">{stage.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold">{stageQ.length}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">{formatCurrency(stageV)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mini list of quotes */}
                <div className="mt-3 pt-3 border-t max-h-[200px] overflow-y-auto space-y-1.5">
                  {sq.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum orçamento</p>}
                  {sq.slice(0, 10).map(q => (
                    <div key={q.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/20">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{q.quote_number}</span>
                      </div>
                      <span className="font-medium text-primary shrink-0 ml-2">{formatCurrency(parseFloat(String(q.total_amount)) || 0)}</span>
                    </div>
                  ))}
                  {sq.length > 10 && <p className="text-[10px] text-muted-foreground text-center">+{sq.length - 10} mais</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="mb-4 md:mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display">Funil de Vendas</h1>
          <p className="text-muted-foreground text-sm">Arraste orçamentos entre as etapas do funil</p>
        </div>

        {isGestor && sellers.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                <Users className="h-4 w-4 mr-2" />
                Comparar Vendedores
                {selectedSellers.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">{selectedSellers.length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <p className="text-sm font-semibold mb-2">Selecione até 3 vendedores</p>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {sellers.map(s => (
                  <label key={s.user_id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5">
                    <Checkbox
                      checked={selectedSellers.includes(s.user_id)}
                      onCheckedChange={() => toggleSeller(s.user_id)}
                    />
                    <span className="text-sm">{s.full_name}</span>
                  </label>
                ))}
              </div>
              {selectedSellers.length > 0 && (
                <Button size="sm" className="w-full mt-3" onClick={() => setCompareMode(true)}>
                  Comparar ({selectedSellers.length})
                </Button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {compareMode && selectedSellers.length > 0 && renderSellerComparison()}

      {/* Summary cards */}
      <div className={isMobile ? 'grid grid-cols-2 gap-2 mb-4' : 'flex gap-3 mb-4 overflow-x-auto pb-1 scrollbar-always-visible'}>
        {STAGES.map(stage => {
          const stageQuotes = getStageQuotes(stage.key);
          return (
            <div
              key={stage.key}
              className={`${isMobile ? '' : 'min-w-[240px] w-[240px]'} flex-shrink-0 rounded-xl border bg-card p-3 shadow-sm`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                <p className="text-sm font-semibold truncate">{stage.label}</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold">{stageQuotes.length}</span>
                <span className="text-xs text-muted-foreground">orçamentos</span>
              </div>
              <p className="text-xs font-medium text-primary mt-0.5">{formatCurrency(getStageValue(stage.key))}</p>
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className={isMobile ? 'space-y-4' : 'flex gap-3 overflow-x-auto pb-4 scrollbar-always-visible'}>
        {STAGES.map((stage, stageIdx) => {
          const stageQuotes = getStageQuotes(stage.key);
          return (
            <div
              key={stage.key}
              className={`${isMobile ? '' : 'min-w-[240px] w-[240px]'} flex-shrink-0`}
              onDragOver={e => handleDragOver(e, stage.key)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, stage.key)}
            >
              <div className={`rounded-xl border-2 transition-colors ${dragOverStage === stage.key ? 'border-primary bg-primary/5' : 'border-border/50 bg-muted/20'} p-3 min-h-[300px]`}>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                  <div className={`w-3 h-3 rounded-full ${stage.color} shadow-sm`} />
                  <h3 className="text-sm font-semibold flex-1">{stage.label}</h3>
                  <Badge variant="secondary" className="text-[10px] font-bold">{stageQuotes.length}</Badge>
                </div>
                <div className="space-y-2">
                  {stageQuotes.map(q => renderQuoteCard(q, stageIdx))}
                  {stageQuotes.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60">
                      <FileText className="h-8 w-8 mb-2" />
                      <p className="text-xs">Nenhum orçamento</p>
                    </div>
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
