import { useEffect, useState, useCallback } from 'react';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { GripVertical, FileText, Users, X, Filter, User } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Using typed client from integrations

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
  const { user, isAdmin, isGestor } = useAuth();
  const isMobile = useIsMobile();
  const [quotes, setQuotes] = useState<PipelineQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedQuote, setDraggedQuote] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [sellerFilter, setSellerFilter] = useState<string>('meus');
  const [sellers, setSellers] = useState<{id: string, name: string}[]>([]);

  const loadSellers = useCallback(async () => {
    // Both Gestor and Admin can see the filter to manage team views
    if (!isGestor && !isAdmin) return;
    
    try {
      console.log("Loading sellers for team filter...");
      const { data: usersData, error: usersError } = await supabaseClient
        .from('profiles')
        .select(`
          user_id,
          full_name,
          role,
          active,
          commercial_visible,
          user_approvals!inner(status)
        `)
        .eq('active', true)
        .eq('commercial_visible', true)
        .eq('user_approvals.status', 'approved');

      if (usersError) {
        console.error("Supabase error loading sellers:", usersError);
        throw usersError;
      }

      console.log("Raw users data fetched:", usersData);

      const filteredSellers = (usersData || [])
        .filter((u: any) => {
          // A seller usually has 'comercial' role or no specific role (default)
          // We exclude administrative roles from the seller selection list
          const nonSellerRoles = ['admin', 'financeiro', 'logistica'];
          return u.role === 'comercial' || !nonSellerRoles.includes(u.role);
        })
        .map((u: any) => ({
          id: u.user_id,
          name: u.full_name || 'Vendedor Sem Nome'
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log("Filtered sellers for select:", filteredSellers);
      setSellers(filteredSellers);
    } catch (err) {
      console.error('Exception in loadSellers:', err);
    }
  }, [isGestor, isAdmin]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      let query = supabaseClient.from('quotes')
        .select('id, quote_number, client_name, status, total_amount, shipping_cost, created_at, created_by, salesperson, salesperson_id');

      // Apply filtering based on role and sellerFilter
      if (isGestor) {
        if (sellerFilter === 'meus') {
          query = query.or(`salesperson_id.eq.${user.id},created_by.eq.${user.id}`);
        } else if (sellerFilter === 'all') {
          // No specific salesperson filter for "all" for gestor
          // In some implementations, gestor might only see a subset, but usually "all" means all active prospects
        } else {
          query = query.eq('salesperson_id', sellerFilter);
        }
      } else if (isAdmin) {
        // Admin logic usually sees everything or follows existing rule
        // Based on the code, it seems it was restricted to 'created_by'
        // Keeping admin rule as is if not specified, but usually admin sees all.
        // The prompt says: "Admin continua seguindo a regra atual dele."
        query = query.eq('created_by', user.id);
      } else {
        // Vendedor
        query = query.eq('created_by', user.id);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const mapped = (data || [])
        .filter((q: any) => q.status && q.status !== 'draft' && q.status !== 'rejected')
        .map((q: any) => ({
          ...q,
          client_name: q.client_name || '',
        }));
      setQuotes(mapped);
    } catch (err) {
      console.error('Error loading pipeline data:', err);
      toast.error('Erro ao carregar dados do funil');
    } finally {
      setLoading(false);
    }
  }, [user?.id, isGestor, isAdmin, sellerFilter]);

  useEffect(() => { 
    loadData(); 
  }, [loadData]);

  useEffect(() => {
    console.log("Pipeline: Checking permissions", { isGestor, isAdmin, userId: user?.id });
    if (isGestor || isAdmin) {
      console.log("Effect: User has management role, loading sellers");
      loadSellers();
    } else {
      console.log("Effect: User does not have management role", { isGestor, isAdmin });
    }
  }, [isGestor, loadSellers]);

  const moveQuote = async (quoteId: string, newStatus: string) => {
    const { error } = await supabaseClient.from('quotes').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', quoteId);
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

  const getStageQuotes = (stage: string, filterQuotes?: PipelineQuote[]) =>
    (filterQuotes || quotes).filter(q => q.status === stage);

  const getStageValue = (stage: string, filterQuotes?: PipelineQuote[]) =>
    getStageQuotes(stage, filterQuotes).reduce((s, q) => s + (parseFloat(String(q.total_amount)) || 0), 0);

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

  return (
    <AppLayout>
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display">Funil de Vendas</h1>
          <p className="text-muted-foreground text-sm">Arraste orçamentos entre as etapas do funil</p>
        </div>

        {isGestor && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger className="w-[200px] bg-card">
                <SelectValue placeholder="Filtrar por vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meus">Meus Orçamentos</SelectItem>
                <SelectItem value="all">Todos os Vendedores</SelectItem>
                {sellers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

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
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60 text-center px-2">
                      {loading ? (
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                      ) : (
                        <>
                          <FileText className="h-8 w-8 mb-2 opacity-20" />
                          <p className="text-xs">
                            {sellerFilter !== 'meus' && sellerFilter !== 'all' 
                              ? "Este vendedor ainda não possui orçamentos no funil."
                              : "Nenhum orçamento nesta etapa"}
                          </p>
                        </>
                      )}
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
