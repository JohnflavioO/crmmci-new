import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Building2, Upload, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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
}

const emptyClient: Omit<Client, 'id'> = {
  company_name: '', cpf_cnpj: '', city: '', state: '', phone: '', email: '',
  contact_name: '', address: '', address_number: '', complement: '',
  neighborhood: '', cep: '', contact_phone: '', contrib_icms: '', notes: '',
};

const db = supabase as any;

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyClient);

  const loadClients = async () => {
    const { data } = await db.from('clients').select('*').order('company_name');
    setClients((data as any[]) || []);
  };

  useEffect(() => { loadClients(); }, []);

  const handleSave = async () => {
    try {
      if (editingClient) {
        const { error } = await db.from('clients').update(form).eq('id', editingClient.id);
        if (error) throw error;
        toast.success('Cliente atualizado!');
      } else {
        const { error } = await db.from('clients').insert({ ...form, created_by: user?.id });
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

  const filtered = clients.filter(c =>
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf_cnpj?.includes(search) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua base de clientes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingClient(null); setForm(emptyClient); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="col-span-2 space-y-2">
                <Label>Razão Social / Nome *</Label>
                <Input value={form.company_name} onChange={e => updateForm('company_name', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <Input value={form.cpf_cnpj} onChange={e => updateForm('cpf_cnpj', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contrib. ICMS</Label>
                <Input value={form.contrib_icms} onChange={e => updateForm('contrib_icms', e.target.value)} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={e => updateForm('address', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input value={form.address_number} onChange={e => updateForm('address_number', e.target.value)} />
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
                <Input value={form.state} onChange={e => updateForm('state', e.target.value)} maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={form.cep} onChange={e => updateForm('cep', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => updateForm('phone', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contato</Label>
                <Input value={form.contact_name} onChange={e => updateForm('contact_name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tel. Contato</Label>
                <Input value={form.contact_phone} onChange={e => updateForm('contact_phone', e.target.value)} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Observações</Label>
                <Input value={form.notes} onChange={e => updateForm('notes', e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.company_name}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.company_name}</TableCell>
                    <TableCell>{c.cpf_cnpj}</TableCell>
                    <TableCell>{[c.city, c.state].filter(Boolean).join('/')}</TableCell>
                    <TableCell>{c.contact_name}</TableCell>
                    <TableCell>{c.phone}</TableCell>
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
    </AppLayout>
  );
}
