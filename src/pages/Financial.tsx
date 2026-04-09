import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { format, isToday, isBefore, startOfDay, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DollarSign, Clock, AlertTriangle, CheckCircle2, Search,
  FileBarChart, QrCode, CreditCard, Banknote, ArrowDownCircle,
  RefreshCw, CalendarDays, CircleDollarSign, Wallet, Users, List
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import FinancialSellerGroup from '@/components/financial/FinancialSellerGroup';
import FinancialSellerRanking from '@/components/financial/FinancialSellerRanking';
import FinancialActionsDoDia from '@/components/financial/FinancialActionsDoDia';
import FinancialForecast from '@/components/financial/FinancialForecast';
import FinancialAlerts from '@/components/financial/FinancialAlerts';
import FinancialConversion from '@/components/financial/FinancialConversion';
import FinancialQuickActions from '@/components/financial/FinancialQuickActions';

const db = supabase as any;

const financialStatusLabels: Record<string, { label: string; color: string }> = {
  aguardando_pagamento: { label: 'Aguardando', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  vence_hoje: { label: 'Vence Hoje', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  em_aberto: { label: 'Em Aberto', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  pago_parcial: { label: 'Pago Parcial', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  pago: { label: 'Pago', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  vencido: { label: 'Vencido', color: 'bg-red-100 text-red-800 border-red-200' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800 border-gray-200' },
};

const paymentMethodConfig: Record<string, { label: string; icon: any; color: string }> = {
  pix: { label: 'PIX', icon: QrCode, color: 'text-teal-600' },
  cartao: { label: 'Cartão', icon: CreditCard, color: 'text-purple-600' },
  boleto: { label: 'Boleto', icon: FileBarChart, color: 'text-amber-600' },
};

export default function Financial() {
  const { user, isFinanceiro } = useAuth();
  const isMobile = useIsMobile();
  const [records, setRecords] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterSeller, setFilterSeller] = useState('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [baixaRecord, setBaixaRecord] = useState<any>(null);
  const [baixaForm, setBaixaForm] = useState({ amount_paid: '', paid_date: '', financial_notes: '', financial_status: 'pago' });
  const [saving, setSaving] = useState(false);

  const canEdit = isFinanceiro;

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const [recordsRes, profilesRes] = await Promise.all([
      db.from('financial_records').select('*').order('due_date', { ascending: true }),
      db.from('profiles').select('user_id, full_name'),
    ]);

    if (profilesRes.data) {
      const map: Record<string, string> = {};
      (profilesRes.data as any[]).forEach((p: any) => { map[p.user_id] = p.full_name || 'Sem nome'; });
      setProfiles(map);
    }

    if (recordsRes.error) {
      toast.error('Erro ao carregar registros financeiros');
    } else {
      const today = startOfDay(new Date());
      const updated = (recordsRes.data || []).map((r: any) => {
        if (['pago', 'cancelado', 'pago_parcial'].includes(r.financial_status)) return r;
        if (r.due_date) {
          const due = startOfDay(new Date(r.due_date));
          if (isToday(due)) return { ...r, financial_status: 'vence_hoje' };
          if (isBefore(due, today)) return { ...r, financial_status: 'vencido' };
        }
        return r;
      });
      setRecords(updated);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const getDateRange = useCallback((period: string) => {
    const now = new Date();
    switch (period) {
      case 'today': return { start: startOfDay(now), end: now };
      case '7days': return { start: subDays(now, 7), end: now };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month': {
        const lm = subMonths(now, 1);
        return { start: startOfMonth(lm), end: endOfMonth(lm) };
      }
      default: return null;
    }
  }, []);

  const filtered = useMemo(() => records.filter(r => {
    if (search) {
      const s = search.toLowerCase();
      if (!r.client_name?.toLowerCase().includes(s) && !r.external_order_id?.includes(search)) return false;
    }
    if (filterStatus !== 'all' && r.financial_status !== filterStatus) return false;
    if (filterMethod !== 'all' && r.payment_method !== filterMethod) return false;
    if (filterSeller !== 'all' && r.created_by !== filterSeller) return false;

    if (filterPeriod === 'overdue') {
      if (!r.due_date || !isBefore(new Date(r.due_date), startOfDay(new Date()))) return false;
      if (['pago', 'cancelado'].includes(r.financial_status)) return false;
    } else if (filterPeriod !== 'all') {
      const range = getDateRange(filterPeriod);
      if (range && r.due_date) {
        const due = new Date(r.due_date);
        if (due < range.start || due > range.end) return false;
      } else if (range && !r.due_date) return false;
    }
    return true;
  }), [records, search, filterStatus, filterMethod, filterPeriod, filterSeller, getDateRange]);

  // Grouped by seller
  const groupedBySeller = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach(r => {
      const uid = r.created_by || 'unknown';
      if (!groups[uid]) groups[uid] = [];
      groups[uid].push(r);
    });
    // Sort groups by open value desc
    return Object.entries(groups)
      .map(([uid, recs]) => ({
        uid,
        name: profiles[uid] || 'Desconhecido',
        records: recs,
        openValue: recs.filter(r => !['pago', 'cancelado'].includes(r.financial_status))
          .reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0),
      }))
      .sort((a, b) => b.openValue - a.openValue);
  }, [filtered, profiles]);

  // Unique sellers for filter
  const sellerOptions = useMemo(() => {
    const uids = new Set(records.map(r => r.created_by).filter(Boolean));
    return Array.from(uids).map(uid => ({ uid, name: profiles[uid] || 'Desconhecido' })).sort((a, b) => a.name.localeCompare(b.name));
  }, [records, profiles]);

  // Stats
  const activeRecords = records.filter(r => !['pago', 'cancelado'].includes(r.financial_status));
  const paidRecords = records.filter(r => r.financial_status === 'pago');
  const totalReceivable = activeRecords.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0);
  const totalPaid = paidRecords.reduce((s, r) => s + (parseFloat(r.amount_paid || r.total_amount) || 0), 0);
  const overdue = records.filter(r => r.financial_status === 'vencido').length;
  const dueToday = records.filter(r => r.financial_status === 'vence_hoje').length;
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const paidThisMonth = paidRecords
    .filter(r => r.paid_date && new Date(r.paid_date) >= monthStart && new Date(r.paid_date) <= monthEnd)
    .reduce((s, r) => s + (parseFloat(r.amount_paid || r.total_amount) || 0), 0);
  const pendingCount = activeRecords.length;
  const baixasCount = paidRecords.filter(r => r.baixa_at).length;

  const methodStats = useMemo(() => {
    const methods = ['boleto', 'pix', 'cartao'];
    return methods.map(m => {
      const mr = records.filter(r => r.payment_method === m);
      return {
        method: m,
        total: mr.length,
        totalValue: mr.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0),
        pending: mr.filter(r => !['pago', 'cancelado'].includes(r.financial_status)).length,
        paid: mr.filter(r => r.financial_status === 'pago').length,
        overdue: mr.filter(r => r.financial_status === 'vencido').length,
      };
    });
  }, [records]);

  const statusStats = useMemo(() => {
    return Object.keys(financialStatusLabels).map(key => ({
      key,
      ...financialStatusLabels[key],
      count: records.filter(r => r.financial_status === key).length,
      value: records.filter(r => r.financial_status === key).reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0),
    }));
  }, [records]);

  const handleOpenBaixa = (record: any) => {
    setBaixaForm({
      amount_paid: record.total_amount?.toString() || '',
      paid_date: format(new Date(), 'yyyy-MM-dd'),
      financial_notes: '',
      financial_status: 'pago',
    });
    setBaixaRecord(record);
  };

  const handleSaveBaixa = async () => {
    if (!baixaRecord || !user) return;
    setSaving(true);
    try {
      const { error } = await db.from('financial_records').update({
        amount_paid: parseFloat(baixaForm.amount_paid) || 0,
        paid_date: baixaForm.paid_date || null,
        financial_status: baixaForm.financial_status,
        financial_notes: baixaForm.financial_notes || null,
        baixa_by: user.id,
        baixa_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', baixaRecord.id);

      if (error) throw error;
      toast.success('Baixa registrada com sucesso!');
      setBaixaRecord(null);
      loadRecords();
    } catch (err: any) {
      toast.error('Erro ao registrar baixa: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <AppLayout>
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display flex items-center gap-2">
            <Banknote className="h-6 w-6 md:h-7 md:w-7 text-primary" /> Financeiro
          </h1>
          <p className="text-muted-foreground text-sm">Contas a receber, baixas e pendências</p>
        </div>
        <div className="flex gap-2 self-start">
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'grouped' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1.5 h-8"
              onClick={() => setViewMode('grouped')}
            >
              <Users className="h-3.5 w-3.5" /> Por Vendedor
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1.5 h-8"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" /> Lista Geral
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={loadRecords} className="gap-2 h-8">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className={cn("grid gap-3 md:gap-4 mb-4 md:mb-6", isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
        <StatCard title="Total a Receber" value={fmt(totalReceivable)} icon={DollarSign} />
        <StatCard title="Recebido no Mês" value={fmt(paidThisMonth)} icon={CircleDollarSign} />
        <StatCard title="Pendentes" value={pendingCount} icon={Clock} />
        <StatCard title="Baixas Realizadas" value={baixasCount} icon={CheckCircle2} />
      </div>

      <div className={cn("grid gap-3 md:gap-4 mb-4 md:mb-6", isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
        <StatCard title="Vencendo Hoje" value={dueToday} icon={CalendarDays} className={dueToday > 0 ? "border-l-4 border-l-orange-500" : ""} />
        <StatCard title="Vencidos" value={overdue} icon={AlertTriangle} className={overdue > 0 ? "border-l-4 border-l-red-500" : ""} />
        <StatCard title="Total Recebido" value={fmt(totalPaid)} icon={Wallet} className="border-l-4 border-l-green-500" />
        <StatCard title="Pagamentos Confirmados" value={paidRecords.length} icon={CheckCircle2} className="border-l-4 border-l-emerald-500" />
      </div>

      {/* Seller Ranking */}
      <FinancialSellerRanking records={records} profilesMap={profiles} fmt={fmt} />

      {/* Resumo por Método */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
        {methodStats.map(ms => {
          const conf = paymentMethodConfig[ms.method];
          if (!conf) return null;
          const Icon = conf.icon;
          return (
            <Card key={ms.method} className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", conf.color)} /> {conf.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Quantidade:</span> <strong>{ms.total}</strong></div>
                  <div><span className="text-muted-foreground">Valor Total:</span> <strong>{fmt(ms.totalValue)}</strong></div>
                  <div><span className="text-muted-foreground">Pendentes:</span> <strong className="text-yellow-600">{ms.pending}</strong></div>
                  <div><span className="text-muted-foreground">Pagos:</span> <strong className="text-emerald-600">{ms.paid}</strong></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Vencidos:</span> <strong className="text-red-600">{ms.overdue}</strong></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumo por Status */}
      <Card className="shadow-card mb-4 md:mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display">Resumo por Status Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {statusStats.map(ss => (
              <div key={ss.key} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-xs", ss.color)}>
                <span className="font-medium">{ss.label}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">{ss.count}</Badge>
                <span className="text-[10px] opacity-75">{fmt(ss.value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className={cn("flex gap-3 flex-wrap", isMobile && "flex-col")}>
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente ou pedido..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <Select value={filterSeller} onValueChange={setFilterSeller}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Vendedores</SelectItem>
                {sellerOptions.map(s => (
                  <SelectItem key={s.uid} value={s.uid}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {Object.entries(financialStatusLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Método" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="last_month">Mês Anterior</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Records */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Nenhum registro financeiro encontrado</p>
          </CardContent>
        </Card>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-4">
          {groupedBySeller.map(group => (
            <FinancialSellerGroup
              key={group.uid}
              sellerName={group.name}
              records={group.records}
              canEdit={canEdit}
              isMobile={isMobile}
              onBaixa={handleOpenBaixa}
              fmt={fmt}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Contas a Receber ({filtered.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isMobile ? (
              <div className="divide-y">
                {filtered.map(r => {
                  const st = financialStatusLabels[r.financial_status] || financialStatusLabels.aguardando_pagamento;
                  const pm = paymentMethodConfig[r.payment_method];
                  const PmIcon = pm?.icon;
                  return (
                    <div key={r.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{r.client_name || 'Sem cliente'}</span>
                        <Badge className={cn('text-xs', st.color)}>{st.label}</Badge>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {PmIcon && <PmIcon className="h-3 w-3" />} {pm?.label || r.payment_method || '-'}
                        </span>
                        <span>Venc: {r.due_date ? format(new Date(r.due_date), 'dd/MM/yyyy') : '-'}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Vendedor: {profiles[r.created_by] || 'Desconhecido'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{fmt(parseFloat(r.total_amount) || 0)}</span>
                        {canEdit && !['pago', 'cancelado'].includes(r.financial_status) && (
                          <Button size="sm" variant="outline" onClick={() => handleOpenBaixa(r)}>
                            <ArrowDownCircle className="h-3 w-3 mr-1" /> Baixa
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Data Pgto</TableHead>
                    {canEdit && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => {
                    const st = financialStatusLabels[r.financial_status] || financialStatusLabels.aguardando_pagamento;
                    const pm = paymentMethodConfig[r.payment_method];
                    const PmIcon = pm?.icon;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{profiles[r.created_by] || 'Desconhecido'}</TableCell>
                        <TableCell className="font-medium">{r.client_name || 'Sem cliente'}</TableCell>
                        <TableCell>
                          {PmIcon ? (
                            <span className="flex items-center gap-1"><PmIcon className="h-3 w-3" /> {pm.label}</span>
                          ) : (r.payment_method || '-')}
                        </TableCell>
                        <TableCell className="font-semibold">{fmt(parseFloat(r.total_amount) || 0)}</TableCell>
                        <TableCell>{r.due_date ? format(new Date(r.due_date), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell><Badge className={cn('text-xs', st.color)}>{st.label}</Badge></TableCell>
                        <TableCell>{r.amount_paid ? fmt(parseFloat(r.amount_paid)) : '-'}</TableCell>
                        <TableCell>{r.paid_date ? format(new Date(r.paid_date), 'dd/MM/yyyy') : '-'}</TableCell>
                        {canEdit && (
                          <TableCell>
                            {!['pago', 'cancelado'].includes(r.financial_status) && (
                              <Button size="sm" variant="outline" onClick={() => handleOpenBaixa(r)}>
                                <ArrowDownCircle className="h-3 w-3 mr-1" /> Baixa
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Baixa Dialog */}
      <Dialog open={!!baixaRecord} onOpenChange={v => !v && setBaixaRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Baixa</DialogTitle>
          </DialogHeader>
          {baixaRecord && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente: <strong>{baixaRecord.client_name}</strong></p>
                <p className="text-sm text-muted-foreground">Valor: <strong>{fmt(parseFloat(baixaRecord.total_amount) || 0)}</strong></p>
                <p className="text-sm text-muted-foreground">Vendedor: <strong>{profiles[baixaRecord.created_by] || 'Desconhecido'}</strong></p>
              </div>
              <div>
                <Label>Valor Recebido</Label>
                <Input type="number" step="0.01" value={baixaForm.amount_paid} onChange={e => setBaixaForm(f => ({ ...f, amount_paid: e.target.value }))} />
              </div>
              <div>
                <Label>Data do Pagamento</Label>
                <Input type="date" value={baixaForm.paid_date} onChange={e => setBaixaForm(f => ({ ...f, paid_date: e.target.value }))} />
              </div>
              <div>
                <Label>Status Financeiro</Label>
                <Select value={baixaForm.financial_status} onValueChange={v => setBaixaForm(f => ({ ...f, financial_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="pago_parcial">Pago Parcial</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observação</Label>
                <Textarea value={baixaForm.financial_notes} onChange={e => setBaixaForm(f => ({ ...f, financial_notes: e.target.value }))} placeholder="Observações da baixa..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBaixaRecord(null)}>Cancelar</Button>
                <Button onClick={handleSaveBaixa} disabled={saving}>
                  {saving ? 'Salvando...' : 'Confirmar Baixa'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
