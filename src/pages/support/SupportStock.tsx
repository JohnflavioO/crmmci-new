import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle, Search, Tags, History, Printer, SlidersHorizontal, Package, MoreHorizontal, Pencil, Trash2, PlusCircle, Wrench, Download, Upload, FileJson, FileSpreadsheet, FileText, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ActionMenu } from '@/components/ActionMenu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type ImportMethod = 'sheet' | 'xml' | 'pdf' | 'text';
type ParsedRow = { name: string; code?: string; price?: number; cost?: number; quantity?: number; location?: string; unit_measure?: string };

const norm = (s: any) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const toNum = (v: any) => {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const HEADER_MAP: Record<string, (keyof ParsedRow)> = {
  codigo: 'code', code: 'code', sku: 'code', ref: 'code', referencia: 'code',
  nome: 'name', descricao: 'name', produto: 'name', name: 'name', item: 'name',
  preco: 'price', precovenda: 'price', valor: 'price', price: 'price', vlrunit: 'price', valorunitario: 'price',
  custo: 'cost', precocusto: 'cost', cost: 'cost',
  qtd: 'quantity', quantidade: 'quantity', estoque: 'quantity', qty: 'quantity', quant: 'quantity',
  local: 'location', localizacao: 'location', location: 'location', prateleira: 'location',
  unidade: 'unit_measure', un: 'unit_measure', unit: 'unit_measure',
};

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
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<{ category: string; brand: string; status: string }>({ category: 'all', brand: 'all', status: 'all' });

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

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.name?.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q);
    const matchCat = filters.category === 'all' || i.category === filters.category;
    const matchBrand = filters.brand === 'all' || i.manufacturer === filters.brand;
    let matchStatus = true;
    if (filters.status === 'in') matchStatus = i.quantity > i.min_quantity;
    else if (filters.status === 'low') matchStatus = i.quantity > 0 && i.quantity <= i.min_quantity;
    else if (filters.status === 'out') matchStatus = i.quantity <= 0;
    return matchSearch && matchCat && matchBrand && matchStatus;
  });

  const activeFilterCount = (filters.category !== 'all' ? 1 : 0) + (filters.brand !== 'all' ? 1 : 0) + (filters.status !== 'all' ? 1 : 0);


  const getStatus = (item: any) => {
    if (item.quantity <= 0) return { label: 'Sem estoque', color: 'destructive' };
    if (item.quantity <= item.min_quantity) return { label: 'Baixo estoque', color: 'warning' };
    return { label: 'Em estoque', color: 'success' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Estoque de Peças</h1>
          <p className="text-sm text-muted-foreground italic">Gerenciamento de componentes Aputure e Astera</p>
        </div>
      </div>

      <Tabs defaultValue="consulta" className="w-full">
        <div className="flex items-center justify-between mb-4 border-b pb-2">
          <TabsList className="bg-transparent h-auto p-0 gap-4">
            <TabsTrigger 
              value="consulta" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-2 flex items-center gap-2"
            >
              <Package className="h-4 w-4" /> Consulta
            </TabsTrigger>
            <TabsTrigger 
              value="manutencao" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-2 flex items-center gap-2"
            >
              <Wrench className="h-4 w-4" /> Manutenção
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="consulta" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <Badge variant="secondary" className="cursor-pointer bg-primary text-white px-3 py-1">Todos</Badge>
              {brands.slice(0, 5).map(b => (
                <Badge key={b.id} variant="outline" className="cursor-pointer hover:bg-muted px-3 py-1">{b.name}</Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingItem(null); }}>
                <DialogTrigger asChild>
                  <Button className="bg-[#00966d] hover:bg-[#007a58]">
                    <Plus className="h-4 w-4 mr-2" /> Nova Peça
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? 'Editar Peça' : 'Adicionar Nova Peça'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Nome da Peça</Label>
                      <Input 
                        value={form.name} 
                        onChange={e => setForm({ ...form, name: e.target.value })} 
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Código (SKU)</Label>
                        <Input 
                          value={form.code} 
                          onChange={e => setForm({ ...form, code: e.target.value })} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Fabricante</Label>
                        </div>
                        <Select value={form.manufacturer} onValueChange={v => setForm({ ...form, manufacturer: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {brands.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Un. por Pacote</Label>
                        <Input 
                          value={form.unit_measure} 
                          onChange={e => setForm({ ...form, unit_measure: e.target.value })} 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <Input 
                          type="number"
                          value={form.quantity} 
                          onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Estoque Mínimo</Label>
                        <Input 
                          type="number"
                          value={form.min_quantity} 
                          onChange={e => setForm({ ...form, min_quantity: Number(e.target.value) })} 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Preço (R$)</Label>
                        <Input 
                          type="number"
                          value={form.price} 
                          onChange={e => setForm({ ...form, price: Number(e.target.value) })} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Localização</Label>
                        <Input 
                          value={form.location} 
                          onChange={e => setForm({ ...form, location: e.target.value })} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>URL da Imagem</Label>
                      <Input 
                        value={form.image_url || ''} 
                        placeholder="https://exemplo.com/imagem.png"
                        onChange={e => setForm({ ...form, image_url: e.target.value })} 
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                      <Button onClick={save} className="bg-[#00966d] hover:bg-[#007a58]">
                        {editingItem ? 'Salvar' : 'Criar Peça'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" className="gap-2" onClick={() => setBrandDialogOpen(true)}>
                <PlusCircle className="h-4 w-4" /> Cadastrar Marca
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nome, código ou categoria..." 
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" /> Filtros
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{activeFilterCount}</Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 space-y-3" align="end">
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={filters.category} onValueChange={v => setFilters(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {Array.from(new Set(items.map(i => i.category).filter(Boolean))).map((c: any) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Marca / Fabricante</Label>
                  <Select value={filters.brand} onValueChange={v => setFilters(f => ({ ...f, brand: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {Array.from(new Set([...brands.map(b => b.name), ...items.map(i => i.manufacturer)].filter(Boolean))).map((b: any) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={filters.status} onValueChange={v => setFilters(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="in">Em estoque</SelectItem>
                      <SelectItem value="low">Baixo estoque</SelectItem>
                      <SelectItem value="out">Sem estoque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setFilters({ category: 'all', brand: 'all', status: 'all' })}>Limpar</Button>
                  <Button size="sm" onClick={() => setFilterOpen(false)}>Aplicar</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[400px]">PEÇA</TableHead>
                  <TableHead>CÓDIGO</TableHead>
                  <TableHead>LOCALIZAÇÃO</TableHead>
                  <TableHead>PREÇO</TableHead>
                  <TableHead>QTD</TableHead>
                  <TableHead className="text-right">AÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden border">
                          <img 
                            src={item.image_url || 'https://picsum.photos/40?grayscale'} 
                            alt="" 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{item.name}</div>
                          <div className="text-xs text-muted-foreground uppercase">{item.category}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{item.code || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{item.location || '-'}</TableCell>
                    <TableCell className="font-medium">
                      <div className="text-xs text-muted-foreground">R$</div>
                      <div>{Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </TableCell>
                    <TableCell>
                      <span className={item.quantity <= item.min_quantity ? "text-destructive font-bold" : "font-bold"}>
                        {item.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionMenu 
                        className="justify-end"
                        actions={[
                          { 
                            label: "Editar", 
                            icon: Pencil, 
                            onClick: () => handleEdit(item),
                            isPrimary: true
                          },
                          { 
                            label: "Excluir", 
                            icon: Trash2, 
                            onClick: () => handleDelete(item.id),
                            variant: 'destructive'
                          }
                        ]} 
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Nenhum item encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="manutencao" className="space-y-6">
          <div className="p-6 border rounded-lg bg-card space-y-6">
            <div className="flex items-center gap-2 text-primary font-medium">
              <AlertTriangle className="h-5 w-5" /> Configuração da Importação
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Selecione a Marca</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {brands.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Método de Entrada</Label>
                <div className="flex bg-muted p-1 rounded-md gap-1">
                  <Button variant="ghost" size="sm" className="bg-white shadow-sm flex-1 gap-2 text-xs">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" /> Planilha (Excel/CSV)
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 gap-2 text-xs">
                    <FileJson className="h-4 w-4 text-orange-500" /> XML (NF-e)
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 gap-2 text-xs">
                    <FileText className="h-4 w-4 text-red-500" /> PDF (DANFE)
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 gap-2 text-xs">
                    <FileText className="h-4 w-4 text-slate-500" /> Texto (Massa)
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center space-y-4 bg-muted/10">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Importar Planilha de Peças</h3>
                <p className="text-sm text-muted-foreground">Arraste seu arquivo CSV ou Excel aqui</p>
                <p className="text-xs text-muted-foreground mt-1">Colunas recomendadas: Código, Nome, Preço, Qtd, Local</p>
              </div>
              <Button className="bg-[#1e293b] hover:bg-[#0f172a] gap-2 px-8">
                <Upload className="h-4 w-4" /> Selecionar Arquivo
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

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
            <Button className="w-full bg-[#00966d] hover:bg-[#007a58]" onClick={handleCreateBrand}>
              Criar Marca
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="text-center py-8 text-xs text-muted-foreground border-t mt-12">
        <p>© 2026 MCI. Todos os direitos reservados.</p>
        <p>Desenvolvido por <span className="text-primary font-medium">Paulinho Fernando</span></p>
      </footer>
    </div>
  );
}
