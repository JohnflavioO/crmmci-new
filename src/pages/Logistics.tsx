import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Truck, PackageCheck, FileText, Search, Eye, Download, ClipboardList,
  AlertTriangle, MapPin, RefreshCw, Clock, CheckCircle2, Package,
  TriangleAlert, History, ArrowRight,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { generateQuotePdf } from '@/lib/generateQuotePdf';

const db = supabase as any;

const logisticsStatusLabels: Record<string, { label: string; color: string }> = {
  aguardando_entrada: { label: 'Aguardando Entrada', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  entrada_realizada: { label: 'Entrada Realizada', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  emitindo_nf: { label: 'Emitindo NF', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  nf_emitida: { label: 'NF Emitida', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  em_separacao: { label: 'Em Separação', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  pronto_envio: { label: 'Pronto p/ Envio', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  enviado: { label: 'Enviado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  em_transporte: { label: 'Em Transporte', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  entregue: { label: 'Entregue', color: 'bg-green-100 text-green-800 border-green-200' },
  problema_logistico: { label: 'Problema', color: 'bg-red-100 text-red-800 border-red-200' },
};

const allStatuses = Object.keys(logisticsStatusLabels);

interface LogisticsRecord {
  id: string;
  quote_id: string;
  logistics_status: string;
  nf_numero: string | null;
  nf_data: string | null;
  codigo_rastreio: string | null;
  transportadora: string | null;
  observacao_logistica: string | null;
  data_envio: string | null;
  data_entrega: string | null;
  entrada_by: string | null;
  entrada_at: string | null;
  created_at: string;
  updated_at: string;
  // joined from quotes
  quote_number?: string;
  client_name?: string;
  salesperson?: string;
  total_amount?: number;
  total?: number;
  approved_at?: string;
  created_by?: string;
  client_id?: string;
  quote_status?: string;
}

export default function Logistics() {
  const { user, isLogistica, isAdmin, isGestor, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'dashboard';
  const isMobile = useIsMobile();

  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);

  // Dialog states
  const [detailRecord, setDetailRecord] = useState<LogisticsRecord | null>(null);
  const [editRecord, setEditRecord] = useState<LogisticsRecord | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNfNumero, setEditNfNumero] = useState('');
  const [editNfData, setEditNfData] = useState('');
  const [editRastreio, setEditRastreio] = useState('');
  const [editTransportadora, setEditTransportadora] = useState('');
  const [editObs, setEditObs] = useState('');
  const [editDataEnvio, setEditDataEnvio] = useState('');
  const [historyRecordId, setHistoryRecordId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const canOperate = isLogistica;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch logistics records with quote data
      const { data: logData, error: logErr } = await db
        .from('logistics_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (logErr) throw logErr;

      // Fetch quotes for joined data
      const quoteIds = (logData || []).map((r: any) => r.quote_id);
      let quotesMap: Record<string, any> = {};
      if (quoteIds.length > 0) {
        const { data: quotes } = await db
          .from('quotes')
          .select('id, quote_number, client_name, salesperson, total_amount, total, approved_at, created_by, client_id, status')
          .in('id', quoteIds);
        (quotes || []).forEach((q: any) => {
          quotesMap[q.id] = q;
        });
      }

      // Fetch seller profiles
      const sellerIds = [...new Set((Object.values(quotesMap) as any[]).map((q: any) => q.created_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (sellerIds.length > 0) {
        const { data: profiles } = await db
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', sellerIds);
        (profiles || []).forEach((p: any) => {
          profilesMap[p.user_id] = p.full_name;
        });
      }

      const merged = (logData || []).map((r: any) => {
        const q = quotesMap[r.quote_id] || {};
        return {
          ...r,
          quote_number: q.quote_number || '',
          client_name: q.client_name || '',
          salesperson: q.salesperson || profilesMap[q.created_by] || '',
          total_amount: q.total_amount || q.total || 0,
          total: q.total || 0,
          approved_at: q.approved_at || '',
          created_by: q.created_by || '',
          client_id: q.client_id || '',
          quote_status: q.status || '',
        };
      });

      setRecords(merged);

      // Build sellers list
      const sellersSet = new Map<string, string>();
      merged.forEach((r: any) => {
        if (r.created_by && r.salesperson) {
          sellersSet.set(r.created_by, r.salesperson);
        }
      });
      setSellers(Array.from(sellersSet.entries()).map(([id, name]) => ({ id, name })));

    } catch (e: any) {
      console.error('Logistics fetch error:', e);
      toast.error('Erro ao carregar dados logísticos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered records
  const filtered = useMemo(() => {
    let list = records;
    if (statusFilter !== 'all') list = list.filter(r => r.logistics_status === statusFilter);
    if (sellerFilter !== 'all') list = list.filter(r => r.created_by === sellerFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        (r.quote_number || '').toLowerCase().includes(s) ||
        (r.client_name || '').toLowerCase().includes(s) ||
        (r.salesperson || '').toLowerCase().includes(s) ||
        (r.nf_numero || '').toLowerCase().includes(s) ||
        (r.codigo_rastreio || '').toLowerCase().includes(s)
      );
    }

    // Tab-specific filters
    if (tab === 'nf') list = list.filter(r => ['emitindo_nf', 'nf_emitida'].includes(r.logistics_status) || !r.nf_numero);
    if (tab === 'envios') list = list.filter(r => ['pronto_envio', 'enviado', 'em_transporte'].includes(r.logistics_status));
    if (tab === 'rastreamento') list = list.filter(r => r.logistics_status === 'enviado' || r.logistics_status === 'em_transporte' || r.codigo_rastreio);
    if (tab === 'problemas') list = list.filter(r => r.logistics_status === 'problema_logistico');

    return list;
  }, [records, statusFilter, sellerFilter, search, tab]);

  // Stats
  const stats = useMemo(() => {
    const s = { aguardando: 0, emitindoNf: 0, prontoEnvio: 0, enviados: 0, transporte: 0, entregues: 0, problemas: 0, semRastreio: 0 };
    records.forEach(r => {
      if (r.logistics_status === 'aguardando_entrada') s.aguardando++;
      if (r.logistics_status === 'emitindo_nf') s.emitindoNf++;
      if (r.logistics_status === 'pronto_envio') s.prontoEnvio++;
      if (r.logistics_status === 'enviado') s.enviados++;
      if (r.logistics_status === 'em_transporte') s.transporte++;
      if (r.logistics_status === 'entregue') s.entregues++;
      if (r.logistics_status === 'problema_logistico') s.problemas++;
      if (['enviado', 'em_transporte'].includes(r.logistics_status) && !r.codigo_rastreio) s.semRastreio++;
    });
    return s;
  }, [records]);

  // Open edit dialog
  const openEdit = (r: LogisticsRecord) => {
    setEditRecord(r);
    setEditStatus(r.logistics_status);
    setEditNfNumero(r.nf_numero || '');
    setEditNfData(r.nf_data || '');
    setEditRastreio(r.codigo_rastreio || '');
    setEditTransportadora(r.transportadora || '');
    setEditObs(r.observacao_logistica || '');
    setEditDataEnvio(r.data_envio || '');
  };

  // Save edit
  const saveEdit = async () => {
    if (!editRecord) return;
    try {
      const previousStatus = editRecord.logistics_status;
      const updates: any = {
        logistics_status: editStatus,
        nf_numero: editNfNumero || null,
        nf_data: editNfData || null,
        codigo_rastreio: editRastreio || null,
        transportadora: editTransportadora || null,
        observacao_logistica: editObs || null,
        data_envio: editDataEnvio || null,
        updated_at: new Date().toISOString(),
      };

      if (editStatus === 'entrada_realizada' && !editRecord.entrada_by) {
        updates.entrada_by = user?.id;
        updates.entrada_at = new Date().toISOString();
      }
      if (editStatus === 'entregue' && !editRecord.data_entrega) {
        updates.data_entrega = new Date().toISOString().split('T')[0];
      }

      const { error } = await db.from('logistics_records').update(updates).eq('id', editRecord.id);
      if (error) throw error;

      // Log action
      if (previousStatus !== editStatus) {
        await db.from('logistics_action_history').insert({
          logistics_record_id: editRecord.id,
          action_type: 'status_change',
          previous_status: previousStatus,
          new_status: editStatus,
          notes: editObs || null,
          performed_by: user?.id,
          performed_by_name: profile?.full_name || '',
        });
      }

      toast.success('Registro logístico atualizado');
      setEditRecord(null);
      fetchData();
    } catch (e: any) {
      toast.error('Erro ao atualizar: ' + (e.message || ''));
    }
  };

  // Quick status change
  const quickStatusChange = async (record: LogisticsRecord, newStatus: string) => {
    try {
      const updates: any = {
        logistics_status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'entrada_realizada' && !record.entrada_by) {
        updates.entrada_by = user?.id;
        updates.entrada_at = new Date().toISOString();
      }

      const { error } = await db.from('logistics_records').update(updates).eq('id', record.id);
      if (error) throw error;

      await db.from('logistics_action_history').insert({
        logistics_record_id: record.id,
        action_type: 'status_change',
        previous_status: record.logistics_status,
        new_status: newStatus,
        performed_by: user?.id,
        performed_by_name: profile?.full_name || '',
      });

      toast.success(`Status atualizado para ${logisticsStatusLabels[newStatus]?.label || newStatus}`);
      fetchData();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || ''));
    }
  };

  // Download PDF
  const downloadPdf = async (record: LogisticsRecord) => {
    try {
      const { data: quote } = await db.from('quotes').select('*').eq('id', record.quote_id).maybeSingle();
      const { data: items } = await db.from('quote_items').select('*').eq('quote_id', record.quote_id).order('item_number');
      let client = null;
      if (quote?.client_id) {
        const { data: c } = await db.from('clients').select('*').eq('id', quote.client_id).maybeSingle();
        client = c;
      }
      await generateQuotePdf(quote, items || [], client);
      toast.success('PDF gerado');
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + (e.message || ''));
    }
  };

  // View history
  const viewHistory = async (recordId: string) => {
    setHistoryRecordId(recordId);
    const { data } = await db
      .from('logistics_action_history')
      .select('*')
      .eq('logistics_record_id', recordId)
      .order('created_at', { ascending: false });
    setHistory(data || []);
  };

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const setTab = (t: string) => setSearchParams({ tab: t });

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = logisticsStatusLabels[status] || { label: status, color: 'bg-muted text-muted-foreground' };
    return <Badge variant="outline" className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</Badge>;
  };

  // Next status helper
  const getNextStatus = (current: string): string | null => {
    const flow = ['aguardando_entrada', 'entrada_realizada', 'emitindo_nf', 'nf_emitida', 'em_separacao', 'pronto_envio', 'enviado', 'em_transporte', 'entregue'];
    const idx = flow.indexOf(current);
    if (idx >= 0 && idx < flow.length - 1) return flow[idx + 1];
    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Logística</h1>
            <p className="text-sm text-muted-foreground">
              {canOperate ? 'Gestão operacional de pedidos' : 'Acompanhamento dos seus pedidos'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} /> Atualizar
          </Button>
        </div>

        {/* Dashboard Tab */}
        {tab === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard title="Aguardando Entrada" value={stats.aguardando} icon={Clock} />
              <StatCard title="Emitindo NF" value={stats.emitindoNf} icon={FileText} />
              <StatCard title="Pronto p/ Envio" value={stats.prontoEnvio} icon={PackageCheck} />
              <StatCard title="Enviados" value={stats.enviados} icon={Truck} />
              <StatCard title="Em Transporte" value={stats.transporte} icon={MapPin} />
              <StatCard title="Entregues" value={stats.entregues} icon={CheckCircle2} />
              <StatCard title="Problemas" value={stats.problemas} icon={TriangleAlert} />
              <StatCard title="Sem Rastreio" value={stats.semRastreio} icon={AlertTriangle} />
            </div>

            {/* Ações do Dia */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ações do Dia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.aguardando > 0 && (
                  <button onClick={() => { setStatusFilter('aguardando_entrada'); setTab('pedidos'); }}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 transition-colors text-sm">
                    <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-yellow-600" /> {stats.aguardando} pedido(s) aguardando entrada</span>
                    <ArrowRight className="h-4 w-4 text-yellow-600" />
                  </button>
                )}
                {stats.emitindoNf > 0 && (
                  <button onClick={() => setTab('nf')}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors text-sm">
                    <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-indigo-600" /> {stats.emitindoNf} pedido(s) com NF pendente</span>
                    <ArrowRight className="h-4 w-4 text-indigo-600" />
                  </button>
                )}
                {stats.semRastreio > 0 && (
                  <button onClick={() => setTab('rastreamento')}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors text-sm">
                    <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-600" /> {stats.semRastreio} enviado(s) sem rastreio</span>
                    <ArrowRight className="h-4 w-4 text-orange-600" />
                  </button>
                )}
                {stats.problemas > 0 && (
                  <button onClick={() => setTab('problemas')}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-sm">
                    <span className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-red-600" /> {stats.problemas} pedido(s) com problema</span>
                    <ArrowRight className="h-4 w-4 text-red-600" />
                  </button>
                )}
                {stats.aguardando === 0 && stats.emitindoNf === 0 && stats.semRastreio === 0 && stats.problemas === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ação pendente 🎉</p>
                )}
              </CardContent>
            </Card>

            {/* Recent records */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Últimos Pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                <RecordsList
                  records={records.slice(0, 10)}
                  canOperate={canOperate}
                  isMobile={isMobile}
                  onEdit={openEdit}
                  onDownloadPdf={downloadPdf}
                  onViewDetail={setDetailRecord}
                  onViewHistory={viewHistory}
                  onQuickStatus={quickStatusChange}
                  getNextStatus={getNextStatus}
                  fmt={fmt}
                  StatusBadge={StatusBadge}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* Pedidos / NF / Envios / Rastreamento / Problemas tabs */}
        {tab !== 'dashboard' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base capitalize">
                {tab === 'pedidos' ? 'Todos os Pedidos' :
                 tab === 'nf' ? 'NF / Emissão' :
                 tab === 'envios' ? 'Envios' :
                 tab === 'rastreamento' ? 'Rastreamento' :
                 tab === 'problemas' ? 'Problemas Logísticos' : 'Pedidos'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                {tab === 'pedidos' && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {allStatuses.map(s => (
                        <SelectItem key={s} value={s}>{logisticsStatusLabels[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={sellerFilter} onValueChange={setSellerFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sellers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <RecordsList
                records={filtered}
                canOperate={canOperate}
                isMobile={isMobile}
                onEdit={openEdit}
                onDownloadPdf={downloadPdf}
                onViewDetail={setDetailRecord}
                onViewHistory={viewHistory}
                onQuickStatus={quickStatusChange}
                getNextStatus={getNextStatus}
                fmt={fmt}
                StatusBadge={StatusBadge}
              />
            </CardContent>
          </Card>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Detalhes do Pedido</DialogTitle></DialogHeader>
            {detailRecord && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Orçamento:</span> <strong>{detailRecord.quote_number}</strong></div>
                  <div><span className="text-muted-foreground">Cliente:</span> <strong>{detailRecord.client_name}</strong></div>
                  <div><span className="text-muted-foreground">Vendedor:</span> <strong>{detailRecord.salesperson}</strong></div>
                  <div><span className="text-muted-foreground">Valor:</span> <strong>{fmt(detailRecord.total_amount || 0)}</strong></div>
                  <div><span className="text-muted-foreground">Aprovado em:</span> <strong>{detailRecord.approved_at ? format(new Date(detailRecord.approved_at), 'dd/MM/yyyy') : '-'}</strong></div>
                  <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={detailRecord.logistics_status} /></div>
                </div>
                <hr />
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">NF:</span> <strong>{detailRecord.nf_numero || '-'}</strong></div>
                  <div><span className="text-muted-foreground">Data NF:</span> <strong>{detailRecord.nf_data ? format(new Date(detailRecord.nf_data), 'dd/MM/yyyy') : '-'}</strong></div>
                  <div><span className="text-muted-foreground">Rastreio:</span> <strong>{detailRecord.codigo_rastreio || '-'}</strong></div>
                  <div><span className="text-muted-foreground">Transportadora:</span> <strong>{detailRecord.transportadora || '-'}</strong></div>
                  <div><span className="text-muted-foreground">Data Envio:</span> <strong>{detailRecord.data_envio ? format(new Date(detailRecord.data_envio), 'dd/MM/yyyy') : '-'}</strong></div>
                  <div><span className="text-muted-foreground">Entrega:</span> <strong>{detailRecord.data_entrega ? format(new Date(detailRecord.data_entrega), 'dd/MM/yyyy') : '-'}</strong></div>
                </div>
                {detailRecord.observacao_logistica && (
                  <div><span className="text-muted-foreground">Obs:</span> <p className="mt-1">{detailRecord.observacao_logistica}</p></div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editRecord} onOpenChange={() => setEditRecord(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Atualizar Pedido - {editRecord?.quote_number}</DialogTitle></DialogHeader>
            {editRecord && (
              <div className="space-y-4">
                <div>
                  <Label>Status Logístico</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allStatuses.map(s => (
                        <SelectItem key={s} value={s}>{logisticsStatusLabels[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nº NF</Label>
                    <Input value={editNfNumero} onChange={e => setEditNfNumero(e.target.value)} placeholder="Número da NF" />
                  </div>
                  <div>
                    <Label>Data NF</Label>
                    <Input type="date" value={editNfData} onChange={e => setEditNfData(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Código Rastreio</Label>
                    <Input value={editRastreio} onChange={e => setEditRastreio(e.target.value)} placeholder="Rastreio" />
                  </div>
                  <div>
                    <Label>Transportadora</Label>
                    <Input value={editTransportadora} onChange={e => setEditTransportadora(e.target.value)} placeholder="Transportadora" />
                  </div>
                </div>
                <div>
                  <Label>Data Envio</Label>
                  <Input type="date" value={editDataEnvio} onChange={e => setEditDataEnvio(e.target.value)} />
                </div>
                <div>
                  <Label>Observação Logística</Label>
                  <Textarea value={editObs} onChange={e => setEditObs(e.target.value)} placeholder="Observações..." />
                </div>
                <Button onClick={saveEdit} className="w-full">Salvar Alterações</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={!!historyRecordId} onOpenChange={() => setHistoryRecordId(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Histórico de Ações</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {history.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum histórico</p>}
              {history.map((h: any) => (
                <div key={h.id} className="p-3 rounded-lg border text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{h.performed_by_name || 'Sistema'}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={h.previous_status || ''} />
                    <ArrowRight className="h-3 w-3" />
                    <StatusBadge status={h.new_status || ''} />
                  </div>
                  {h.notes && <p className="mt-1 text-muted-foreground">{h.notes}</p>}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

// Records list component
function RecordsList({
  records, canOperate, isMobile, onEdit, onDownloadPdf, onViewDetail, onViewHistory, onQuickStatus, getNextStatus, fmt, StatusBadge,
}: {
  records: LogisticsRecord[];
  canOperate: boolean;
  isMobile: boolean;
  onEdit: (r: LogisticsRecord) => void;
  onDownloadPdf: (r: LogisticsRecord) => void;
  onViewDetail: (r: LogisticsRecord) => void;
  onViewHistory: (id: string) => void;
  onQuickStatus: (r: LogisticsRecord, status: string) => void;
  getNextStatus: (status: string) => string | null;
  fmt: (v: number) => string;
  StatusBadge: React.FC<{ status: string }>;
}) {
  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado</p>;
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {records.map(r => {
          const next = getNextStatus(r.logistics_status);
          return (
            <Card key={r.id} className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">{r.quote_number}</p>
                  <p className="text-xs text-muted-foreground">{r.client_name}</p>
                </div>
                <StatusBadge status={r.logistics_status} />
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Vendedor: {r.salesperson}</p>
                <p>Valor: {fmt(r.total_amount || 0)}</p>
                {r.nf_numero && <p>NF: {r.nf_numero}</p>}
                {r.codigo_rastreio && <p>Rastreio: {r.codigo_rastreio}</p>}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onViewDetail(r)}>
                  <Eye className="h-3 w-3 mr-1" /> Ver
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onDownloadPdf(r)}>
                  <Download className="h-3 w-3 mr-1" /> PDF
                </Button>
                {canOperate && (
                  <>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onEdit(r)}>
                      <ClipboardList className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    {next && (
                      <Button size="sm" variant="default" className="text-xs h-7" onClick={() => onQuickStatus(r, next)}>
                        <ArrowRight className="h-3 w-3 mr-1" /> {logisticsStatusLabels[next]?.label}
                      </Button>
                    )}
                  </>
                )}
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => onViewHistory(r.id)}>
                  <History className="h-3 w-3 mr-1" /> Histórico
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Orçamento</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>NF</TableHead>
            <TableHead>Rastreio</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map(r => {
            const next = getNextStatus(r.logistics_status);
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.quote_number}</TableCell>
                <TableCell>{r.client_name}</TableCell>
                <TableCell>{r.salesperson}</TableCell>
                <TableCell>{fmt(r.total_amount || 0)}</TableCell>
                <TableCell><StatusBadge status={r.logistics_status} /></TableCell>
                <TableCell>{r.nf_numero || '-'}</TableCell>
                <TableCell>{r.codigo_rastreio || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onViewDetail(r)} title="Ver detalhes">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownloadPdf(r)} title="Baixar PDF">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {canOperate && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(r)} title="Editar">
                        <ClipboardList className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canOperate && next && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onQuickStatus(r, next)} title="Avançar status">
                        <ArrowRight className="h-3.5 w-3.5 mr-1" /> {logisticsStatusLabels[next]?.label}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onViewHistory(r.id)} title="Histórico">
                      <History className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
