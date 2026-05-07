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
import { Plus, AlertTriangle, Search, Tags, History, Printer, SlidersHorizontal, Package, MoreHorizontal, Pencil, Trash2, PlusCircle, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CATEGORIES = ['Aputure', 'Amaran', 'Astera', 'Creamsource', 'Outros'];
const MAINTENANCE_STATUS = ['Aguardando', 'Em Manutenção', 'Pronto', 'Entregue'];

export default function SupportStock() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingMaintenance, setEditingMaintenance] = useState<any>(null);
  const [form, setForm] = useState<any>({
    name: '', code: '', manufacturer: '', compatibility: '', location: '',
    quantity: 0, min_quantity: 0, cost: 0, price: 0, notes: '', category: 'Outros',
    unit_measure: 'UN'
  });
  const [mForm, setMForm] = useState<any>({
    brand: '', model: '', description: '', technician: '', status: 'Aguardando', notes: ''
  });

  const load = async () => {
    const { data: products } = await supabase.from('technical_products' as any).select('*').order('name');
    setItems((products || []) as any[]);
    
    const { data: brandList } = await supabase.from('technical_brands' as any).select('*').order('name');
    setBrands((brandList || []) as any[]);

    const { data: maintList } = await supabase.from('technical_maintenances' as any).select('*').order('created_at', { ascending: false });
    setMaintenances((maintList || []) as any[]);
  };

  const loadBrands = async () => {
    const { data: brandList } = await supabase.from('technical_brands' as any).select('*').order('name');
    setBrands((brandList || []) as any[]);
  };

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) return toast.error('Nome da marca é obrigatório');
    const { data, error } = await supabase.from('technical_brands' as any).insert({ name: newBrandName.trim() }).select();
    if (error) return toast.error(error.message);
    toast.success('Marca criada com sucesso');
    
    const brand = (data as any[])?.[0];
    if (brand && open) {
      setForm((prev: any) => ({ ...prev, manufacturer: brand.name }));
    }
    if (brand && maintenanceOpen) {
      setMForm((prev: any) => ({ ...prev, brand: brand.name }));
    }
    
    setNewBrandName('');
    setBrandDialogOpen(false);
    loadBrands();
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

  const saveMaintenance = async () => {
    if (!mForm.brand || !mForm.model || !mForm.description) return toast.error('Marca, Modelo e Descrição são obrigatórios');
    
    if (editingMaintenance) {
      const { error } = await supabase.from('technical_maintenances' as any).update(mForm).eq('id', editingMaintenance.id);
      if (error) return toast.error(error.message);
      toast.success('Manutenção atualizada');
    } else {
      const { error } = await supabase.from('technical_maintenances' as any).insert(mForm);
      if (error) return toast.error(error.message);
      toast.success('Manutenção cadastrada');
    }
    
    setMaintenanceOpen(false);
    setEditingMaintenance(null);
    setMForm({ brand: '', model: '', description: '', technician: '', status: 'Aguardando', notes: '' });
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

  const handleEditMaintenance = (m: any) => {
    setEditingMaintenance(m);
    setMForm({
      brand: m.brand, model: m.model, description: m.description,
      technician: m.technician, status: m.status, notes: m.notes
    });
    setMaintenanceOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este item?')) return;
    const { error } = await supabase.from('technical_products' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Item excluído');
    load();
  };

  const handleDeleteMaintenance = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta manutenção?')) return;
    const { error } = await supabase.from('technical_maintenances' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Manutenção excluída');
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
          <Dialog open={maintenanceOpen} onOpenChange={(o) => { setMaintenanceOpen(o); if (!o) setEditingMaintenance(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
                <Wrench className="h-4 w-4" /> Manutenção
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingMaintenance ? 'Editar Manutenção' : 'Nova Manutenção'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Marca</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-1 text-primary flex items-center gap-1 hover:bg-transparent"
                        onClick={() => setBrandDialogOpen(true)}
                      >
                        <PlusCircle className="h-3 w-3" />
                      </Button>
                    </div>
                    <Select value={mForm.brand} onValueChange={v => setMForm({ ...mForm, brand: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {brands.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo</Label>
                    <Input 
                      placeholder="Ex: 600d Pro" 
                      value={mForm.model} 
                      onChange={e => setMForm({ ...mForm, model: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>O que fazer? (Serviço)</Label>
                  <Textarea 
                    placeholder="Descreva o problema ou serviço..." 
                    value={mForm.description} 
                    onChange={e => setMForm({ ...mForm, description: e.target.value })} 
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Técnico</Label>
                    <Input 
                      placeholder="Nome do técnico" 
                      value={mForm.technician} 
                      onChange={e => setMForm({ ...mForm, technician: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={mForm.status} onValueChange={v => setMForm({ ...mForm, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MAINTENANCE_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações Internas</Label>
                  <Input 
                    placeholder="Notas extras..." 
                    value={mForm.notes} 
                    onChange={e => setMForm({ ...mForm, notes: e.target.value })} 
                  />
                </div>

                <Button onClick={saveMaintenance} className="w-full">
                  {editingMaintenance ? 'Salvar Alterações' : 'Cadastrar Manutenção'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
                  <Label className="text-sm font-medium">Código (SKU)</Label>
                  <Input 
                    placeholder="Ex: SKU-12345"
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
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Fabricante</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-1 text-primary flex items-center gap-1 hover:bg-transparent"
                      onClick={() => setBrandDialogOpen(true)}
                    >
                      <PlusCircle className="h-3 w-3" /> Nova Marca
                    </Button>
                  </div>
                  <Select value={form.manufacturer} onValueChange={v => setForm({ ...form, manufacturer: v })}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione o fabricante" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(b => (
                        <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                      ))}
                      {brands.length === 0 && (
                        <div className="p-2 text-xs text-muted-foreground text-center">Nenhuma marca cadastrada</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-4">
                  <Label className="text-sm font-medium">Localização</Label>
                  <Input 
                    placeholder="Gaveta B2"
                    value={form.location} 
                    onChange={e => setForm({ ...form, location: e.target.value })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium">Un. por Pacote</Label>
                  <Input 
                    placeholder="Ex: 10"
                    value={form.unit_measure} 
                    onChange={e => setForm({ ...form, unit_measure: e.target.value })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-3">
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

                <div className="col-span-3">
                  <Label className="text-sm font-medium">Preço (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0,00"
                    value={form.price} 
                    onChange={e => setForm({ ...form, price: Number(e.target.value) })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-3">
                  <Label className="text-sm font-medium">Estoque Mínimo</Label>
                  <Input 
                    type="number" 
                    value={form.min_quantity} 
                    onChange={e => setForm({ ...form, min_quantity: Number(e.target.value) })} 
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-6">
                  <Label className="text-sm font-medium">Observações</Label>
                  <Textarea 
                    placeholder="Detalhes técnicos adicionais..."
                    value={form.notes} 
                    onChange={e => setForm({ ...form, notes: e.target.value })} 
                    className="mt-1.5 min-h-[80px]"
                  />
                </div>

                <Button onClick={save} className="col-span-6 mt-2 bg-primary hover:bg-primary/90">
                  {editingItem ? 'Salvar Alterações' : 'Cadastrar Peça'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Tags className="h-4 w-4" /> Marcas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle>Marcas de Fabricantes</DialogTitle>
                  <Button size="sm" onClick={() => setBrandDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Nova
                  </Button>
                </div>
              </DialogHeader>
              <div className="space-y-2 pt-4 max-h-[400px] overflow-y-auto pr-2">
                {brands.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-2 border rounded-md">
                    <span>{b.name}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                        if (!confirm('Deseja excluir esta marca?')) return;
                        const { error } = await supabase.from('technical_brands' as any).delete().eq('id', b.id);
                        if (error) return toast.error('Não é possível excluir: existem produtos vinculados a esta marca.');
                        toast.success('Marca excluída');
                        loadBrands();
                      }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {brands.length === 0 && (
                  <p className="text-center py-4 text-muted-foreground">Nenhuma marca cadastrada.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Criar Nova Marca</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nome da Marca</Label>
                  <Input 
                    placeholder="Ex: Aputure, Sony, etc" 
                    value={newBrandName}
                    onChange={e => setNewBrandName(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleCreateBrand}>
                  Criar Marca
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Package className="h-4 w-4" /> Categorias
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

      <Tabs defaultValue="stock" className="w-full">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="stock" className="gap-2">
            <Package className="h-4 w-4" /> Estoque de Peças
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2">
            <Wrench className="h-4 w-4" /> Manutenções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-6 space-y-6">
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
        </TabsContent>

        <TabsContent value="maintenance" className="mt-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Serviço / Problema</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenances.map((m) => (
                    <TableRow key={m.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div className="font-medium">{m.model}</div>
                        <div className="text-xs text-muted-foreground">{m.brand}</div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {m.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {m.technician || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          m.status === 'Pronto' ? 'success' : 
                          m.status === 'Em Manutenção' ? 'warning' : 
                          m.status === 'Entregue' ? 'outline' : 'secondary'
                        } className="font-normal">
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditMaintenance(m)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteMaintenance(m.id)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {maintenances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Wrench className="h-10 w-10 opacity-20" />
                          <p>Nenhuma manutenção registrada.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
