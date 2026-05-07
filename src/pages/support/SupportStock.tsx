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
import { Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const CATEGORIES = ['Aputure', 'Amaran', 'Astera', 'Creamsource', 'Outros'];

export default function SupportStock() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', code: '', manufacturer: '', compatibility: '', location: '',
    quantity: 0, min_quantity: 0, cost: 0, price: 0, notes: '', category: 'Outros',
  });

  const load = async () => {
    const { data } = await supabase.from('technical_products' as any).select('*').order('name');
    setItems((data || []) as any[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error('Nome obrigatório');
    const { error } = await supabase.from('technical_products' as any).insert({ ...form, created_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success('Peça cadastrada');
    setOpen(false);
    setForm({ name: '', code: '', manufacturer: '', compatibility: '', location: '', quantity: 0, min_quantity: 0, cost: 0, price: 0, notes: '', category: 'Outros' });
    load();
  };

  const lowStock = items.filter(i => Number(i.quantity) <= Number(i.min_quantity || 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estoque de Peças</h1>
          <p className="text-sm text-muted-foreground">Estoque técnico — separado do comercial</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Peça</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Peça</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Código</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>Fabricante</Label><Input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></div>
              <div className="col-span-2"><Label>Compatibilidade</Label><Input value={form.compatibility} onChange={e => setForm({ ...form, compatibility: e.target.value })} /></div>
              <div><Label>Localização</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Quantidade</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
              <div><Label>Mínimo</Label><Input type="number" value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: Number(e.target.value) })} /></div>
              <div><Label>Custo</Label><Input type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: Number(e.target.value) })} /></div>
              <div><Label>Preço</Label><Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={save} className="col-span-2">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span>{lowStock.length} peça(s) com estoque abaixo do mínimo</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{items.length} peça(s)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead><TableHead>Código</TableHead><TableHead>Categoria</TableHead>
                <TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(i => {
                const low = Number(i.quantity) <= Number(i.min_quantity || 0);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>{i.code}</TableCell>
                    <TableCell><Badge variant="outline">{i.category}</Badge></TableCell>
                    <TableCell className={`text-right ${low ? 'text-destructive font-bold' : ''}`}>{i.quantity}</TableCell>
                    <TableCell className="text-right">R$ {Number(i.price).toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma peça cadastrada</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
