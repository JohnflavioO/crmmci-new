import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, MessageCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ActionMenu } from '@/components/ActionMenu';

export const STATUS_OPTIONS = [
  { key: 'recebido', label: 'Recebido' },
  { key: 'diagnostico', label: 'Diagnóstico' },
  { key: 'aguardando_aprovacao', label: 'Aguardando Aprovação' },
  { key: 'aguardando_peca', label: 'Aguardando Peça' },
  { key: 'em_reparo', label: 'Em Reparo' },
  { key: 'pronto', label: 'Pronto' },
  { key: 'entregue', label: 'Entregue' },
  { key: 'cancelado', label: 'Cancelado' },
];

export default function SupportOrders() {
  const { user, profile } = useAuth();
  const [params] = useSearchParams();
  const filterStatus = params.get('status') || '';
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(params.get('new') === 'true');
  const [form, setForm] = useState<any>({
    client_id: '', client_name: '', equipment: '', brand: '', model: '', serial: '',
    reported_defect: '', status: 'recebido', os_type: 'Corretiva',
    entry_date: new Date().toISOString().split('T')[0]
  });

  const load = async () => {
    let q = supabase.from('technical_orders' as any).select('*').order('created_at', { ascending: false });
    if (filterStatus) q = q.eq('status', filterStatus);
    const { data } = await q;
    setOrders((data || []) as any[]);
  };
  useEffect(() => { load(); }, [filterStatus]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from('technical_clients' as any).select('id,name').order('name');
    setClients((data || []) as any[]);
  })(); }, []);

  const save = async () => {
    if (!form.client_id) return toast.error('Selecione o cliente');
    const cli = clients.find(c => c.id === form.client_id);
    const { error } = await supabase.from('technical_orders' as any).insert({
      ...form,
      client_name: cli?.name || '',
      created_by: user?.id,
      technician_id: user?.id,
      technician_name: profile?.full_name,
    });
    if (error) return toast.error(error.message);
    toast.success('OS criada');
    setOpen(false);
    setForm({ client_id: '', client_name: '', equipment: '', brand: '', model: '', serial: '', reported_defect: '', status: 'recebido' });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">{filterStatus ? `Filtro: ${filterStatus}` : 'Todas as OS'}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova OS</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Ordem de Serviço</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-4">
              <div className="col-span-2">
                <Label>Cliente</Label>
                <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente..." /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de OS</Label>
                <Select value={form.os_type} onValueChange={v => setForm({ ...form, os_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corretiva">Corretiva</SelectItem>
                    <SelectItem value="Preventiva">Preventiva</SelectItem>
                    <SelectItem value="Garantia">Garantia</SelectItem>
                    <SelectItem value="Orçamento">Orçamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Entrada</Label>
                <Input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Equipamento</Label>
                <Input value={form.equipment} placeholder="Ex: Câmera Sony A7III" onChange={e => setForm({ ...form, equipment: e.target.value })} />
              </div>
              <div><Label>Marca</Label><Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></div>
              <div><Label>Modelo</Label><Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></div>
              <div className="col-span-2"><Label>Serial / Número de Série</Label><Input value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} /></div>
              <div className="col-span-2"><Label>Defeito Relatado / Observações</Label><Textarea value={form.reported_defect} placeholder="Descreva o problema relatado pelo cliente..." onChange={e => setForm({ ...form, reported_defect: e.target.value })} /></div>
              <div className="col-span-2 flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save} className="bg-[#00966d] hover:bg-[#007a58]">Criar Ordem de Serviço</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{orders.length} OS</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OS</TableHead><TableHead>Cliente</TableHead><TableHead>Equipamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(o => (
                <TableRow key={o.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell><Link to={`/suporte/os/${o.id}`} className="font-medium text-primary hover:underline">{o.os_number}</Link></TableCell>
                  <TableCell>{o.client_name}</TableCell>
                  <TableCell>{o.equipment}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-normal">{STATUS_OPTIONS.find(s => s.key === o.status)?.label || o.status}</Badge></TableCell>
                  <TableCell className="text-right font-medium">R$ {Number(o.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">
                    <ActionMenu 
                      className="justify-end"
                      actions={[
                        { 
                          label: "Ver Detalhes", 
                          icon: ExternalLink, 
                          onClick: () => window.location.href = `/suporte/os/${o.id}`,
                          isPrimary: true
                        },
                        { 
                          label: "WhatsApp", 
                          icon: MessageCircle, 
                          onClick: () => {
                            const phone = o.clients?.phone || o.phone || '';
                            if (phone) window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
                            else toast.error("Telefone não disponível");
                          },
                          className: "text-green-600"
                        },
                        { 
                          label: "Excluir", 
                          icon: Trash2, 
                          onClick: async () => {
                            if (!confirm('Deseja excluir esta OS?')) return;
                            const { error } = await supabase.from('technical_orders' as any).delete().eq('id', o.id);
                            if (error) toast.error(error.message);
                            else { toast.success('OS excluída'); load(); }
                          },
                          variant: 'destructive'
                        }
                      ]} 
                    />
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma OS</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
