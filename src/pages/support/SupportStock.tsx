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
import { Plus, AlertTriangle, Search, Tags, History, Printer, SlidersHorizontal, Package, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const CATEGORIES = ['Aputure', 'Amaran', 'Astera', 'Creamsource', 'Outros'];

export default function SupportStock() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState<any>({
    name: '', code: '', manufacturer: '', compatibility: '', location: '',
    quantity: 0, min_quantity: 0, cost: 0, price: 0, notes: '', category: 'Outros',
    unit_measure: 'UN'
  });

  const load = async () => {
    const { data } = await supabase.from('technical_products' as any).select('*').order('name');
    setItems((data || []) as any[]);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error('Nome obrigatório');
    
    const payload = { ...form, created_by: user?.id };
    
    if (editingItem) {
      const { error } = await supabase.from('technical_products' as any).update(payload).eq('id', editingItem.id);
      if (error) return toast.error(error.message);
      toast.success('Peça atualizada');
    } else {
      const { error } = await supabase.from('technical_products' as any).insert(payload);
      if (error) return toast.error(error.message);
      toast.success('Peça cadastrada');
    }
    
    setOpen(false);
    setEditingItem(null);
    setForm({ name: '', code: '', manufacturer: '', compatibility: '', location: '', quantity: 0, min_quantity: 0, cost: 0, price: 0, notes: '', category: 'Outros', unit_measure: 'UN' });
    load();
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setForm({
      name: item.name, code: item.code, manufacturer: item.manufacturer,
      compatibility: item.compatibility, location: item.location,
      quantity: item.quantity, min_quantity: item.min_quantity,
      cost: Number(item.cost), price: Number(item.price),
      notes: item.notes, category: item.category,
      unit_measure: item.unit_measure || 'UN'
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este item?')) return;
    const { error } = await supabase.from('technical_products' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Item excluído');
    load();
  };

  const filtered = items.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.code?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatus = (item: any) => {
    if (item.quantity <= 0) return { label: 'Sem estoque', color: 'destructive' };
    if (item.quantity <= item.min_quantity) return { label: 'Baixo estoque', color: 'warning' };
    return { label: 'Em estoque', color: 'success' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Estoque</h1>
          <p className="text-sm text-muted-foreground italic">Controle de peças e insumos técnicos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingItem(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" /> Nova Peça
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Editar Peça' : 'Nova Peça'}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-6 gap-4 pt-4">
                <div className="col-span-3">
                  <Label className="text-sm font-medium">Nome da Peça</Label>
                  <Input 
                    placeholder="Nome da peça"
                    value={form.name} 
                    onChange={e => setForm({ ...form, name: e.target.value })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-3">
                  <Label className="text-sm font-medium">Código / Part Number</Label>
                  <Input 
                    placeholder="Ex: PN-12345"
                    value={form.code} 
                    onChange={e => setForm({ ...form, code: e.target.value })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-3">
                  <Label className="text-sm font-medium">Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-3">
                  <Label className="text-sm font-medium">Fabricante / Fornecedor</Label>
                  <Input 
                    placeholder="Nome do fabricante"
                    value={form.manufacturer} 
                    onChange={e => setForm({ ...form, manufacturer: e.target.value })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-6">
                  <Label className="text-sm font-medium">Compatibilidade (Modelos)</Label>
                  <Input 
                    placeholder="Ex: Aputure 600d, 1200d..."
                    value={form.compatibility} 
                    onChange={e => setForm({ ...form, compatibility: e.target.value })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium">Localização</Label>
                  <Input 
                    placeholder="Gaveta B2"
                    value={form.location} 
                    onChange={e => setForm({ ...form, location: e.target.value })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium">Unidade de Medida</Label>
                  <Select value={form.unit_measure} onValueChange={v => setForm({ ...form, unit_measure: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['UN', 'MT', 'KG', 'PCT', 'CX', 'LITRO'].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium">Custo (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0,00"
                    value={form.cost} 
                    onChange={e => setForm({ ...form, cost: Number(e.target.value) })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium">Preço de Venda (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0,00"
                    value={form.price} 
                    onChange={e => setForm({ ...form, price: Number(e.target.value) })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium">Estoque Inicial</Label>
                  <Input 
                    type="number" 
                    value={form.quantity} 
                    onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium">Estoque Mínimo</Label>
                  <Input 
                    type="number" 
                    value={form.min_quantity} 
                    onChange={e => setForm({ ...form, min_quantity: Number(e.target.value) })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium">Unidade de Medida</Label>
                  <Select value={form.unit_measure} onValueChange={v => setForm({ ...form, unit_measure: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['UN', 'MT', 'KG', 'PCT', 'CX', 'LITRO'].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-6">
                  <Label className="text-sm font-medium">Descrição</Label>
                  <Textarea 
                    placeholder="Detalhes adicionais sobre o produto..."
                    value={form.notes} 
                    onChange={e => setForm({ ...form, notes: e.target.value })} 
                    className="mt-1.5 min-h-[100px]"
                  />
                </div>

                <Button onClick={save} className="col-span-6 mt-2 bg-primary hover:bg-primary/90">
                  {editingItem ? 'Salvar Alterações' : 'Salvar Produto'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Tags className="h-4 w-4" /> Categorias
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Categorias Disponíveis</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 pt-4">
                {CATEGORIES.map(c => (
                  <div key={c} className="flex items-center justify-between p-2 border rounded-md">
                    <span>{c}</span>
                    <Badge variant="secondary">Padrao</Badge>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-2 italic">As categorias são predefinidas no sistema.</p>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="gap-2" onClick={() => toast.info('Funcionalidade de histórico será implementada em breve.')}>
            <History className="h-4 w-4" /> Histórico
          </Button>
          
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir Estoque
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Pesquise por nome, código ou fabricante..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" /> Filtros
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[80px]">ID</TableHead>
                <TableHead>Nome do Item</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Qtd Atual</TableHead>
                <TableHead className="text-right">Valor Unit.</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item, idx) => {
                const status = getStatus(item);
                const total = item.quantity * (Number(item.price) || 0);
                return (
                  <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="text-xs text-muted-foreground">#{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.code || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {Number(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2 w-2 rounded-full ${
                          status.color === 'success' ? 'bg-green-500' : 
                          status.color === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className="text-sm">{status.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Package className="h-10 w-10 opacity-20" />
                      <p>Nenhum item encontrado no estoque.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
