import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus, Search, Pencil, Trash2, CheckCircle2, Clock, AlertTriangle,
  Phone, CreditCard, Truck, MessageCircle, MoreHorizontal, CalendarDays,
  CircleDot, ListChecks, Filter
} from 'lucide-react';

const db = supabase as any;

const taskTypes: Record<string, { label: string; icon: any; color: string }> = {
  contato: { label: 'Contato', icon: Phone, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  cobranca: { label: 'Cobrança', icon: CreditCard, color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'follow-up': { label: 'Follow-up', icon: MessageCircle, color: 'bg-purple-100 text-purple-800 border-purple-200' },
  entrega: { label: 'Entrega', icon: Truck, color: 'bg-teal-100 text-teal-800 border-teal-200' },
  outro: { label: 'Outro', icon: MoreHorizontal, color: 'bg-gray-100 text-gray-800 border-gray-200' },
};

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pendente: { label: 'Pendente', icon: Clock, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  em_andamento: { label: 'Em andamento', icon: CircleDot, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  concluida: { label: 'Concluída', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  atrasada: { label: 'Atrasada', icon: AlertTriangle, color: 'bg-red-100 text-red-800 border-red-200' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'bg-gray-100 text-gray-700' },
  média: { label: 'Média', color: 'bg-yellow-100 text-yellow-700' },
  alta: { label: 'Alta', color: 'bg-red-100 text-red-700' },
};

interface Task {
  id: string;
  title: string;
  description: string;
  task_type: string;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  quote_id: string | null;
  client_id: string | null;
  user_id: string;
  created_at: string;
  quote?: { quote_number: string; client_name: string; total: number } | null;
  client?: { name: string } | null;
}

export default function Tasks() {
  const { user, isGestor } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', task_type: 'contato', status: 'pendente',
    priority: 'média', due_date: '', quote_id: '', client_id: '',
  });

  const load = async () => {
    const { data } = await db.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false });
    if (!data) return;

    const quoteIds = data.filter((t: any) => t.quote_id).map((t: any) => t.quote_id);
    const clientIds = data.filter((t: any) => t.client_id).map((t: any) => t.client_id);

    let quotesMap: Record<string, any> = {};
    let clientsMap: Record<string, any> = {};

    if (quoteIds.length) {
      const { data: qd } = await db.from('quotes').select('id, quote_number, client_name, total').in('id', quoteIds);
      (qd || []).forEach((q: any) => { quotesMap[q.id] = q; });
    }
    if (clientIds.length) {
      const { data: cd } = await db.from('clients').select('id, name').in('id', clientIds);
      (cd || []).forEach((c: any) => { clientsMap[c.id] = c; });
    }

    const enriched = data.map((t: any) => {
      // Auto-mark overdue
      if (t.due_date && new Date(t.due_date) < new Date() && t.status === 'pendente') {
        t.status = 'atrasada';
      }
      return { ...t, quote: quotesMap[t.quote_id] || null, client: clientsMap[t.client_id] || null };
    });
    setTasks(enriched);
  };

  const loadSelects = async () => {
    const [{ data: q }, { data: c }] = await Promise.all([
      db.from('quotes').select('id, quote_number, client_name').order('created_at', { ascending: false }).limit(50),
      db.from('clients').select('id, name').order('name').limit(200),
    ]);
    setQuotes(q || []);
    setClients(c || []);
  };

  useEffect(() => { load(); loadSelects(); }, []);

  const resetForm = () => {
    setForm({ title: '', description: '', task_type: 'contato', status: 'pendente', priority: 'média', due_date: '', quote_id: '', client_id: '' });
    setEditing(null);
  };

  const openNew = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      title: t.title, description: t.description || '', task_type: t.task_type,
      status: t.status, priority: t.priority,
      due_date: t.due_date ? new Date(t.due_date).toISOString().slice(0, 16) : '',
      quote_id: t.quote_id || '', client_id: t.client_id || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error('Título é obrigatório'); return; }
    const payload: any = {
      title: form.title, description: form.description || null,
      task_type: form.task_type, status: form.status, priority: form.priority,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      quote_id: form.quote_id || null, client_id: form.client_id || null,
      completed_at: form.status === 'concluida' ? new Date().toISOString() : null,
    };

    if (editing) {
      const { error } = await db.from('tasks').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Tarefa atualizada!');
    } else {
      payload.user_id = user?.id;
      const { error } = await db.from('tasks').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Tarefa criada!');
    }
    setDialogOpen(false);
    resetForm();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta tarefa?')) return;
    await db.from('tasks').delete().eq('id', id);
    toast.success('Tarefa excluída');
    load();
  };

  const toggleComplete = async (t: Task) => {
    const newStatus = t.status === 'concluida' ? 'pendente' : 'concluida';
    await db.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'concluida' ? new Date().toISOString() : null,
    }).eq('id', t.id);
    load();
  };

  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterType !== 'all' && t.task_type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.title.toLowerCase().includes(s) ||
        (t.quote?.client_name || '').toLowerCase().includes(s) ||
        (t.client?.name || '').toLowerCase().includes(s);
    }
    return true;
  });

  // Stats
  const pendentes = tasks.filter(t => t.status === 'pendente' || t.status === 'atrasada').length;
  const emAndamento = tasks.filter(t => t.status === 'em_andamento').length;
  const concluidas = tasks.filter(t => t.status === 'concluida').length;
  const atrasadas = tasks.filter(t => t.status === 'atrasada').length;

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <ListChecks className="h-7 w-7 text-accent" /> Tarefas
          </h1>
          <p className="text-muted-foreground">Gerencie suas atividades e acompanhamentos</p>
        </div>
        <Button onClick={openNew} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="h-4 w-4 mr-2" /> Criar tarefa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pendentes', value: pendentes, icon: Clock, color: 'text-yellow-600' },
          { label: 'Em andamento', value: emAndamento, icon: CircleDot, color: 'text-blue-600' },
          { label: 'Concluídas', value: concluidas, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Atrasadas', value: atrasadas, icon: AlertTriangle, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarefas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(taskTypes).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary accordion */}
      <Card className="shadow-card mb-4">
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3">Nenhuma tarefa encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Negociação</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(t => {
                    const st = statusConfig[t.status] || statusConfig.pendente;
                    const tt = taskTypes[t.task_type] || taskTypes.outro;
                    const pr = priorityConfig[t.priority] || priorityConfig.média;
                    const StIcon = st.icon;
                    const TtIcon = tt.icon;
                    return (
                      <TableRow key={t.id} className={t.status === 'concluida' ? 'opacity-60' : ''}>
                        <TableCell>
                          <button onClick={() => toggleComplete(t)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${t.status === 'concluida' ? 'bg-accent border-accent text-accent-foreground' : 'border-muted-foreground/30 hover:border-accent'}`}>
                            {t.status === 'concluida' && <CheckCircle2 className="h-3 w-3" />}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TtIcon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className={`font-medium ${t.status === 'concluida' ? 'line-through' : ''}`}>{t.title}</p>
                              {t.client?.name && <p className="text-xs text-muted-foreground">{t.client.name}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={tt.color}>{tt.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={st.color}>
                            <StIcon className="h-3 w-3 mr-1" />{st.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={pr.color}>{pr.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(t.due_date)}</TableCell>
                        <TableCell>
                          {t.quote ? (
                            <div>
                              <p className="text-sm font-medium text-primary">{t.quote.client_name}</p>
                              <p className="text-xs text-muted-foreground">#{t.quote.quote_number}</p>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {t.quote?.total ? formatCurrency(t.quote.total) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Confirmar entrada de 30%" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.task_type} onValueChange={v => setForm({ ...form, task_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(taskTypes).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Data e hora</Label>
              <Input type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vincular orçamento</Label>
                <Select value={form.quote_id} onValueChange={v => setForm({ ...form, quote_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {quotes.map((q: any) => <SelectItem key={q.id} value={q.id}>#{q.quote_number} - {q.client_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vincular cliente</Label>
                <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={save} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {editing ? 'Salvar' : 'Criar tarefa'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
