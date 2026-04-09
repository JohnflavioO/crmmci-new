import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format, isToday, isBefore, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  DollarSign, Clock, AlertTriangle, CheckCircle2, CalendarIcon,
  Search, FileBarChart, QrCode, CreditCard, Banknote, TrendingDown,
  ArrowDownCircle, Filter, RefreshCw
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

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

const paymentMethodIcons: Record<string, { label: string; icon: any }> = {
  pix: { label: 'PIX', icon: QrCode },
  cartao: { label: 'Cartão', icon: CreditCard },
  boleto: { label: 'Boleto', icon: FileBarChart },
};

export default function Financial() {
  const { user, isAdmin, isFinanceiro } = useAuth();
  const isMobile = useIsMobile();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [baixaRecord, setBaixaRecord] = useState<any>(null);
  const [baixaForm, setBaixaForm] = useState({ amount_paid: '', paid_date: '', financial_notes: '', financial_status: 'pago' });
  const [saving, setSaving] = useState(false);

  const canEdit = isAdmin || isFinanceiro;

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from('financial_records')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar registros financeiros');
      console.error(error);
    } else {
      // Auto-update statuses based on dates
      const today = startOfDay(new Date());
      const updated = (data || []).map((r: any) => {
        if (r.financial_status === 'pago' || r.financial_status === 'cancelado' || r.financial_status === 'pago_parcial') return r;
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

  const filtered = records.filter(r => {
    if (search && !r.client_name?.toLowerCase().includes(search.toLowerCase()) && !r.external_order_id?.includes(search)) return false;
    if (filterStatus !== 'all' && r.financial_status !== filterStatus) return false;
    if (filterMethod !== 'all' && r.payment_method !== filterMethod) return false;
    if (filterPeriod === '7days') {
      if (!r.due_date) return false;
      const due = new Date(r.due_date);
      const limit = addDays(new Date(), 7);
      if (due > limit) return false;
    }
    if (filterPeriod === 'today') {
      if (!r.due_date || !isToday(new Date(r.due_date))) return false;
    }
    if (filterPeriod === 'overdue') {
      if (!r.due_date || !isBefore(new Date(r.due_date), startOfDay(new Date()))) return false;
      if (r.financial_status === 'pago' || r.financial_status === 'cancelado') return false;
    }
    return true;
  });

  // Stats
  const totalReceivable = records.filter(r => !['pago', 'cancelado'].includes(r.financial_status)).reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0);
  const totalPaid = records.filter(r => r.financial_status === 'pago').reduce((s, r) => s + (parseFloat(r.amount_paid || r.total_amount) || 0), 0);
  const overdue = records.filter(r => r.financial_status === 'vencido').length;
  const pendingBoleto = records.filter(r => r.payment_method === 'boleto' && !['pago', 'cancelado'].includes(r.financial_status)).length;
  const pendingPix = records.filter(r => r.payment_method === 'pix' && !['pago', 'cancelado'].includes(r.financial_status)).length;
  const dueToday = records.filter(r => r.due_date && isToday(new Date(r.due_date)) && !['pago', 'cancelado'].includes(r.financial_status)).length;

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Banknote className="h-7 w-7 text-accent" /> Financeiro
        </h1>
        <p className="text-muted-foreground">Contas a receber, baixas e pendências</p>
      </div>

      {/* Dashboard Cards */}
      <div className={cn("grid gap-4 mb-6", isMobile ? "grid-cols-2" : "grid-cols-3 lg:grid-cols-6")}>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">A Receber</span>
            </div>
            <p className="text-lg font-bold">{fmt(totalReceivable)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Recebido</span>
            </div>
            <p className="text-lg font-bold">{fmt(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Vencidos</span>
            </div>
            <p className="text-lg font-bold text-red-600">{overdue}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileBarChart className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Boletos Pend.</span>
            </div>
            <p className="text-lg font-bold">{pendingBoleto}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <QrCode className="h-4 w-4 text-teal-500" />
              <span className="text-xs text-muted-foreground">PIX Pend.</span>
            </div>
            <p className="text-lg font-bold">{pendingPix}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Vence Hoje</span>
            </div>
            <p className="text-lg font-bold text-orange-600">{dueToday}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className={cn("flex gap-3 flex-wrap", isMobile && "flex-col")}>
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
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
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="today">Vence Hoje</SelectItem>
                <SelectItem value="7days">Próx. 7 dias</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadRecords}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Contas a Receber ({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhum registro financeiro encontrado</p>
          ) : isMobile ? (
            <div className="divide-y">
              {filtered.map(r => {
                const st = financialStatusLabels[r.financial_status] || financialStatusLabels.aguardando_pagamento;
                const pm = paymentMethodIcons[r.payment_method];
                return (
                  <div key={r.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">{r.client_name || 'Sem cliente'}</span>
                      <Badge className={cn('text-xs', st.color)}>{st.label}</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pm ? pm.label : r.payment_method || '-'}</span>
                      <span>Venc: {r.due_date ? format(new Date(r.due_date), 'dd/MM/yyyy') : '-'}</span>
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
                  const pm = paymentMethodIcons[r.payment_method];
                  const PmIcon = pm?.icon;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.client_name || 'Sem cliente'}</TableCell>
                      <TableCell>
                        {PmIcon && <span className="flex items-center gap-1"><PmIcon className="h-3 w-3" /> {pm.label}</span>}
                        {!PmIcon && (r.payment_method || '-')}
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
