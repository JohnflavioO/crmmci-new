import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Building2, Upload, Loader2, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import ClientFilterBar from '@/components/clients/ClientFilterBar';
import ClientFilterDrawer, { emptyFilters } from '@/components/clients/ClientFilterDrawer';
import { useClientFilters } from '@/components/clients/useClientFilters';

interface Client {
  id: string;
  company_name: string;
  cpf_cnpj: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  contact_name: string;
  address: string;
  address_number: string;
  complement: string;
  neighborhood: string;
  cep: string;
  contact_phone: string;
  contrib_icms: string;
  notes: string;
  is_whatsapp: boolean;
  created_by?: string;
  created_at?: string;
  last_interaction_at?: string;
}

const emptyClient: Omit<Client, 'id'> = {
  company_name: '', cpf_cnpj: '', city: '', state: '', phone: '', email: '',
  contact_name: '', address: '', address_number: '', complement: '',
  neighborhood: '', cep: '', contact_phone: '', contrib_icms: '', notes: '',
  is_whatsapp: false,
};

const db = supabase as any;

interface SellerInfo {
  user_id: string;
  full_name: string;
}

export default function Clients() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allQuotes, setAllQuotes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyClient);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [sellers, setSellers] = useState<SellerInfo[]>([]);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const canSeeAll = false;

  const loadClients = async () => {
    if (!user?.id) {
      setAllClients([]);
      return;
    }

    const { data } = await db
      .from('clients')
      .select('*')
      .eq('created_by', user.id)
      .order('company_name');

    setAllClients((data as any[]) || []);
  };

  const loadQuotes = async () => {
    if (!user?.id) {
      setAllQuotes([]);
      return;
    }

    const { data } = await db
      .from('quotes')
      .select('id, client_id, status, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    setAllQuotes((data as any[]) || []);
  };

  useEffect(() => {
    if (!user?.id) {
      setAllClients([]);
      setAllQuotes([]);
      return;
    }

    loadClients();
    loadQuotes();
  }, [user?.id]);

  // Advanced filters hook
  const {
    filters, setFilters,
    ownerFilter, setOwnerFilter,
    activePreset, applyPreset,
    activeFilterCount,
    drawerOpen, setDrawerOpen,
    clearAll,
    filtered: filteredByAdvanced,
  } = useClientFilters({
    clients: allClients,
    quotes: allQuotes,
    currentUserId: user?.id || '',
    canSeeAll,
  });

  // Apply text search on top of advanced filters
  const filtered = (filteredByAdvanced as Client[]).filter(c =>
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf_cnpj?.includes(search) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    try {
      if (editingClient) {
        const { error } = await db.from('clients').update(form).eq('id', editingClient.id);
        if (error) throw error;
        toast.success('Cliente atualizado!');
      } else {
        const { error } = await db.from('clients').insert({ ...form, name: form.company_name || '', created_by: user?.id });
        if (error) throw error;
        toast.success('Cliente criado!');
      }
      setDialogOpen(false);
      setForm(emptyClient);
      setEditingClient(null);
      loadClients();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setForm(client);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cliente?')) return;
    const { error } = await db.from('clients').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Cliente excluído'); loadClients(); }
  };

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState('');

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || bulkDeleteConfirm !== 'EXCLUIR') return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await db.from('clients').delete().in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} cliente(s) excluído(s)`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      setBulkDeleteConfirm('');
      loadClients();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const validateCnpj = (cnpj: string): boolean => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return false;
    if (/^(\d)\1+$/.test(digits)) return false;
    const calc = (str: string, weights: number[]) =>
      weights.reduce((sum, w, i) => sum + parseInt(str[i]) * w, 0);
    const d1Weights = [5,4,3,2,9,8,7,6,5,4,3,2];
    const d2Weights = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const r1 = calc(digits, d1Weights) % 11;
    const d1 = r1 < 2 ? 0 : 11 - r1;
    if (parseInt(digits[12]) !== d1) return false;
    const r2 = calc(digits, d2Weights) % 11;
    const d2 = r2 < 2 ? 0 : 11 - r2;
    return parseInt(digits[13]) === d2;
  };

  const handleCnpjChange = async (value: string) => {
    updateForm('cpf_cnpj', value);
    const cleanCnpj = value.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;
    if (!validateCnpj(cleanCnpj)) {
      toast.error('CNPJ inválido');
      return;
    }
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.info('CNPJ não encontrado na base de dados');
        } else {
          toast.error('Erro ao consultar CNPJ. Preencha manualmente.');
        }
        return;
      }
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        company_name: data.razao_social || prev.company_name,
        phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0,2)}) ${data.ddd_telefone_1.substring(2)}` : prev.phone,
        email: data.email && data.email !== 'null' ? data.email : prev.email,
        cep: data.cep ? data.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : prev.cep,
        address: data.logradouro || prev.address,
        address_number: data.numero || prev.address_number,
        complement: data.complemento || prev.complement,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
      }));
      toast.success('Dados da empresa preenchidos automaticamente!');
    } catch {
      toast.error('Erro ao consultar CNPJ. Preencha manualmente.');
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleCepChange = async (value: string) => {
    const cleanCep = value.replace(/\D/g, '');
    updateForm('cep', value);
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setForm(prev => ({
            ...prev,
            address: data.logradouro || prev.address,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
            complement: data.complemento || prev.complement,
          }));
          toast.success('Endereço preenchido automaticamente!');
        }
      } catch {
        // silently fail
      }
    }
  };

  const detectWhatsApp = (phone: string): boolean => {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    const withoutCountry = digits.startsWith('55') ? digits.substring(2) : digits;
    return withoutCountry.length === 11 && withoutCountry[2] === '9';
  };

  const [importOpen, setImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImportSheet = async () => {
    if (!sheetUrl.trim()) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-clients-sheet', {
        body: { url: sheetUrl.trim() },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Erro ao importar');

      const validFields = [
        'company_name', 'cpf_cnpj', 'city', 'state', 'phone', 'email',
        'contact_name', 'address', 'address_number', 'complement',
        'neighborhood', 'cep', 'contact_phone', 'contrib_icms', 'notes'
      ];
      
      const clientsToInsert = data.clients.map((c: any) => {
        const clean: Record<string, any> = {};
        for (const field of validFields) {
          if (c[field]) clean[field] = c[field];
        }
        clean.name = c.company_name || c.name || '';
        clean.created_by = user?.id || '';
        clean.is_whatsapp = detectWhatsApp(c.phone || '') || detectWhatsApp(c.contact_phone || '');
        return clean;
      });

      let inserted = 0;
      let errors = 0;
      for (const client of clientsToInsert) {
        const { error: insertErr } = await db.from('clients').insert(client);
        if (!insertErr) inserted++;
        else {
          errors++;
          console.error('Erro ao inserir cliente:', client.company_name, insertErr);
        }
      }

      const matchedFields = Object.keys(data.matched_columns || {});
      toast.success(`${inserted} clientes importados! Campos mapeados: ${matchedFields.join(', ')}`, { duration: 6000 });
      if (errors > 0) toast.warning(`${errors} clientes não puderam ser importados`);
      
      setImportOpen(false);
      setSheetUrl('');
      loadClients();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [ownerFilter]);

  const getSellerName = (userId: string) => {
    if (userId === user?.id) return 'Você';
    const seller = sellers.find(s => s.user_id === userId);
    return seller?.full_name || 'Desconhecido';
  };

  const showSellerColumn = canSeeAll && ownerFilter !== 'mine';

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display">Clientes</h1>
          <p className="text-muted-foreground text-sm">Gerencie sua base de clientes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <Button variant="destructive" className="gap-2 min-h-[44px]" onClick={() => { setBulkDeleteOpen(true); setBulkDeleteConfirm(''); }} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir {selectedIds.size}
            </Button>
          )}
          <Button variant="outline" className="gap-2 min-h-[44px] border-primary text-primary hover:bg-primary/5" onClick={() => navigate('/quotes')}>
            <Plus className="h-4 w-4" /> Criar Orçamento
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 min-h-[44px]"><Upload className="h-4 w-4" /> Importar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Clientes</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Cole o link da sua planilha Google compartilhada.
                </p>
                <div className="space-y-2">
                  <Label>Link da Planilha</Label>
                  <Input
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={sheetUrl}
                    onChange={e => setSheetUrl(e.target.value)}
                    inputMode="url"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setImportOpen(false)} className="min-h-[44px]">Cancelar</Button>
                  <Button onClick={handleImportSheet} disabled={importing || !sheetUrl.trim()} className="min-h-[44px]">
                    {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importando...</> : 'Importar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingClient(null); setForm(emptyClient); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2 min-h-[44px]"><Plus className="h-4 w-4" /> Novo Cliente</Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="sm:col-span-2 space-y-2">
                <Label>Razão Social / Nome *</Label>
                <Input value={form.company_name} onChange={e => updateForm('company_name', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <div className="relative">
                  <Input value={form.cpf_cnpj} onChange={e => handleCnpjChange(e.target.value)} inputMode="numeric" placeholder="Digite o CNPJ para buscar" />
                  {cnpjLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Contrib. ICMS</Label>
                <Input value={form.contrib_icms} onChange={e => updateForm('contrib_icms', e.target.value)} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={e => updateForm('address', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input value={form.address_number} onChange={e => updateForm('address_number', e.target.value)} inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input value={form.complement} onChange={e => updateForm('complement', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={form.neighborhood} onChange={e => updateForm('neighborhood', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.city} onChange={e => updateForm('city', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Select value={form.state || 'none'} onValueChange={v => updateForm('state', v === 'none' ? '' : v)}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={form.cep} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label>Celular</Label>
                <Input value={form.phone} inputMode="tel" onChange={e => {
                  updateForm('phone', e.target.value);
                  setForm(prev => ({ ...prev, phone: e.target.value, is_whatsapp: detectWhatsApp(e.target.value) }));
                }} />
                <div className="flex items-center gap-2 mt-1">
                  <Checkbox
                    checked={form.is_whatsapp}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_whatsapp: !!checked }))}
                  />
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> WhatsApp
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" inputMode="email" value={form.email} onChange={e => updateForm('email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nome do Responsável</Label>
                <Input value={form.contact_name} onChange={e => updateForm('contact_name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.contact_phone} inputMode="tel" onChange={e => updateForm('contact_phone', e.target.value)} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Observações</Label>
                <Input value={form.notes} onChange={e => updateForm('notes', e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="min-h-[44px]">Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.company_name} className="min-h-[44px]">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filter bar */}
      <ClientFilterBar
        canSeeAll={canSeeAll}
        sellers={sellers}
        currentUserId={user?.id || ''}
        ownerFilter={ownerFilter}
        onOwnerFilterChange={setOwnerFilter}
        activeFilterCount={activeFilterCount}
        onOpenDrawer={() => setDrawerOpen(true)}
        onApplyPreset={applyPreset}
        activePreset={activePreset}
        onClearAll={clearAll}
      />

      {/* Filter drawer */}
      <ClientFilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        filters={filters}
        onChange={setFilters}
        onApply={() => {}}
        onClear={() => setFilters(emptyFilters)}
      />

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            {filtered.length > 0 && (
              <p className="text-sm text-muted-foreground">{filtered.length} cliente(s)</p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3">Nenhum cliente encontrado</p>
              {(activeFilterCount > 0 || activePreset) && (
                <Button variant="link" className="mt-2" onClick={clearAll}>Limpar filtros</Button>
              )}
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filtered.map(c => (
                <div key={c.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onCheckedChange={() => toggleSelect(c.id)}
                      />
                      <div>
                        <p className="font-medium text-sm">{c.company_name}</p>
                        <p className="text-xs text-muted-foreground">{c.cpf_cnpj || '-'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(c)} className="h-10 w-10">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)} className="h-10 w-10">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>{[c.city, c.state].filter(Boolean).join('/') || '-'}</span>
                    <span className="flex items-center gap-1">
                      {c.phone || '-'}
                      {(c as any).is_whatsapp && <MessageCircle className="h-3 w-3 text-emerald-500" />}
                    </span>
                    {c.contact_name && <span>{c.contact_name}</span>}
                    {showSellerColumn && <span>{getSellerName(c.created_by || '')}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  {showSellerColumn && <TableHead>Vendedor</TableHead>}
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} data-state={selectedIds.has(c.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onCheckedChange={() => toggleSelect(c.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{c.company_name}</TableCell>
                    <TableCell>{c.cpf_cnpj}</TableCell>
                    <TableCell>{[c.city, c.state].filter(Boolean).join('/')}</TableCell>
                    <TableCell>{c.contact_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {c.phone}
                        {(c as any).is_whatsapp && (
                          <span title="WhatsApp"><MessageCircle className="h-4 w-4 text-emerald-500" /></span>
                        )}
                      </div>
                    </TableCell>
                    {showSellerColumn && (
                      <TableCell className="text-xs text-muted-foreground">{getSellerName(c.created_by || '')}</TableCell>
                    )}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão em massa */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(o) => { setBulkDeleteOpen(o); if (!o) setBulkDeleteConfirm(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirmar Exclusão em Massa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Você está prestes a excluir <strong>{selectedIds.size}</strong> cliente(s). Esta ação não pode ser desfeita.
            </p>
            <p className="text-sm font-medium">
              Para confirmar, digite <strong>EXCLUIR</strong> no campo abaixo:
            </p>
            <Input
              value={bulkDeleteConfirm}
              onChange={e => setBulkDeleteConfirm(e.target.value)}
              placeholder="Digite EXCLUIR para confirmar"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkDeleteConfirm !== 'EXCLUIR' || deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Excluir Definitivamente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
