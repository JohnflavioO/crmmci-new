import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Search, Plus, User, BadgeAlert, BadgeCheck, BadgeX, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ActionMenu } from '@/components/ActionMenu';
import { Pencil, Trash2, MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const STATUS_OPTIONS = [
  { key: 'rascunho', label: 'Rascunho' },
  { key: 'enviado', label: 'Enviado' },
  { key: 'aprovado', label: 'Aprovado' },
  { key: 'recusado', label: 'Recusado' },
];

interface Budget {
  id: string;
  status: string;
  total_services: number;
  total_parts: number;
  discount: number;
  total_amount: number;
  valid_until: string | null;
  notes: string | null;
  client_id: string | null;
  technical_order_id: string | null;
  created_at: string;
  technical_clients: { name: string; whatsapp?: string | null; phone?: string | null } | null;
  technical_orders: { os_number: string } | null;
}

export default function SupportBudgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const emptyForm = { technical_order_id: '', total_services: 0, total_parts: 0, discount: 0, valid_until: '', notes: '', status: 'rascunho' };
  const [form, setForm] = useState<any>(emptyForm);

  const fetchBudgets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('technical_budgets')
      .select('*, technical_clients(name, whatsapp, phone), technical_orders(os_number)')
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar orçamentos');
    setBudgets((data || []) as any);
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data } = await supabase.from('technical_orders' as any)
      .select('id, os_number, client_id, client_name, equipment, parts_value, labor_value')
      .order('created_at', { ascending: false }).limit(200);
    setOrders((data || []) as any[]);
  };

  useEffect(() => { fetchBudgets(); fetchOrders(); }, []);

  const total = useMemo(() => Math.max(0, Number(form.total_services || 0) + Number(form.total_parts || 0) - Number(form.discount || 0)), [form]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = async (b: Budget) => {
    setEditing(b);
    if (b.technical_order_id && !orders.find(o => o.id === b.technical_order_id)) {
      const { data } = await supabase.from('technical_orders' as any)
        .select('id, os_number, client_id, client_name, equipment, parts_value, labor_value')
        .eq('id', b.technical_order_id).maybeSingle();
      if (data) setOrders(prev => [data as any, ...prev]);
    }
    setForm({
      technical_order_id: b.technical_order_id || '',
      total_services: Number(b.total_services) || 0,
      total_parts: Number(b.total_parts) || 0,
      discount: Number(b.discount) || 0,
      valid_until: b.valid_until || '',
      notes: b.notes || '',
      status: b.status,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.technical_order_id) return toast.error('Selecione a OS');
    const ord = orders.find(o => o.id === form.technical_order_id);
    const payload: any = {
      technical_order_id: form.technical_order_id,
      client_id: ord?.client_id || null,
      total_services: Number(form.total_services) || 0,
      total_parts: Number(form.total_parts) || 0,
      discount: Number(form.discount) || 0,
      total_amount: total,
      valid_until: form.valid_until || null,
      notes: form.notes || null,
      status: form.status,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('technical_budgets').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('technical_budgets').insert({ ...payload, created_by: user?.id }));
    }
    if (error) return toast.error(error.message);
    toast.success(editing ? 'Orçamento atualizado' : 'Orçamento criado');
    setOpen(false);
    fetchBudgets();
  };

  const sendWhatsApp = (b: Budget) => {
    const phone = b.technical_clients?.whatsapp || b.technical_clients?.phone || '';
    if (!phone) return toast.error('Cliente sem telefone');
    const msg = `Olá ${b.technical_clients?.name || ''}! Segue o orçamento da OS ${b.technical_orders?.os_number || ''}:\n\nServiços: R$ ${Number(b.total_services).toFixed(2)}\nPeças: R$ ${Number(b.total_parts).toFixed(2)}\nDesconto: R$ ${Number(b.discount).toFixed(2)}\n*Total: R$ ${Number(b.total_amount).toFixed(2)}*\n\nVálido até: ${b.valid_until ? new Date(b.valid_until).toLocaleDateString('pt-BR') : '—'}`;
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const printBudget = (b: Budget) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Orçamento ${b.technical_orders?.os_number || ''}</title>
      <style>body{font-family:system-ui;padding:40px;max-width:700px;margin:auto}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}.tot{font-size:20px;font-weight:bold;text-align:right;margin-top:20px}</style></head><body>
      <h1>Orçamento — OS ${b.technical_orders?.os_number || ''}</h1>
      <p><strong>Cliente:</strong> ${b.technical_clients?.name || '—'}</p>
      <p><strong>Validade:</strong> ${b.valid_until ? new Date(b.valid_until).toLocaleDateString('pt-BR') : '—'}</p>
      <table><tr><th>Descrição</th><th style="text-align:right">Valor</th></tr>
      <tr><td>Serviços / Mão de obra</td><td style="text-align:right">R$ ${Number(b.total_services).toFixed(2)}</td></tr>
      <tr><td>Peças</td><td style="text-align:right">R$ ${Number(b.total_parts).toFixed(2)}</td></tr>
      <tr><td>Desconto</td><td style="text-align:right">- R$ ${Number(b.discount).toFixed(2)}</td></tr></table>
      <p class="tot">Total: R$ ${Number(b.total_amount).toFixed(2)}</p>
      ${b.notes ? `<p><strong>Observações:</strong><br>${b.notes.replace(/\n/g, '<br>')}</p>` : ''}
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const remove = async (b: Budget) => {
    if (!confirm('Excluir orçamento?')) return;
    const { error } = await supabase.from('technical_budgets').delete().eq('id', b.id);
    if (error) return toast.error(error.message);
    toast.success('Excluído');
    fetchBudgets();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'enviado': return <Badge variant="outline" className="border-blue-500 text-blue-600 gap-1"><Clock className="h-3 w-3" /> Enviado</Badge>;
      case 'aprovado': return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"><BadgeCheck className="h-3 w-3" /> Aprovado</Badge>;
      case 'recusado': return <Badge className="bg-rose-500 hover:bg-rose-600 text-white gap-1"><BadgeX className="h-3 w-3" /> Recusado</Badge>;
      default: return <Badge variant="secondary" className="gap-1"><BadgeAlert className="h-3 w-3" /> Rascunho</Badge>;
    }
  };

  const filteredBudgets = budgets.filter(b =>
    b.technical_clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.technical_orders?.os_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamentos Técnicos</h1>
          <p className="text-sm text-muted-foreground">Emissão e acompanhamento de propostas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />Novo Orçamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs">Ordem de Serviço</Label>
                <Select value={form.technical_order_id} onValueChange={(v) => {
                  const ord = orders.find(o => o.id === v);
                  setForm((f: any) => ({ ...f, technical_order_id: v, total_parts: f.total_parts || Number(ord?.parts_value || 0), total_services: f.total_services || Number(ord?.labor_value || 0) }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione a OS..." /></SelectTrigger>
                  <SelectContent>{orders.map(o => <SelectItem key={o.id} value={o.id}>{o.os_number} — {o.client_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Serviços</Label><Input type="number" step="0.01" value={form.total_services} onChange={e => setForm({ ...form, total_services: e.target.value })} /></div>
                <div><Label className="text-xs">Peças</Label><Input type="number" step="0.01" value={form.total_parts} onChange={e => setForm({ ...form, total_parts: e.target.value })} /></div>
                <div><Label className="text-xs">Desconto</Label><Input type="number" step="0.01" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Validade</Label><Input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} /></div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="border-t pt-2 text-right">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">R$ {total.toFixed(2)}</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card p-4 rounded-xl border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente ou OS..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="h-40" /></Card>)
        ) : filteredBudgets.length > 0 ? (
          filteredBudgets.map(budget => (
            <Card key={budget.id} className="hover:border-primary/50 transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Badge variant="secondary" className="text-[10px] font-bold">OS: {budget.technical_orders?.os_number || 'N/A'}</Badge>
                {getStatusBadge(budget.status)}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-full"><User className="h-4 w-4 text-muted-foreground" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{budget.technical_clients?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-xs text-muted-foreground">Expira: {budget.valid_until ? new Date(budget.valid_until).toLocaleDateString('pt-BR') : '--'}</div>
                  <div className="text-lg font-bold">R$ {Number(budget.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="flex justify-center pt-2 border-t">
                  <ActionMenu className="w-full justify-center" actions={[
                    { label: 'Imprimir / PDF', icon: FileText, onClick: () => printBudget(budget), isPrimary: true },
                    { label: 'WhatsApp', icon: MessageCircle, onClick: () => sendWhatsApp(budget), className: 'text-green-600' },
                    { label: 'Editar', icon: Pencil, onClick: () => openEdit(budget) },
                    { label: 'Excluir', icon: Trash2, onClick: () => remove(budget), variant: 'destructive' },
                  ]} />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4"><FileText className="h-8 w-8 text-muted-foreground" /></div>
            <p className="text-lg font-semibold">Nenhum orçamento encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
