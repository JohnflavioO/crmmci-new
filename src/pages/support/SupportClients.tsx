import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Progress } from '@/components/ui/progress';

export default function SupportClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<any>({ 
    name: '', 
    cpf_cnpj: '', 
    phone: '', 
    whatsapp: '', 
    email: '', 
    address: '', 
    city: '',
    state: '',
    zip_code: '',
    notes: '' 
  });

  const load = async () => {
    const { data } = await supabase.from('technical_clients' as any).select('*').order('created_at', { ascending: false });
    setClients((data || []) as any[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error('Nome obrigatório');
    const { error } = await supabase.from('technical_clients' as any).insert({ ...form, created_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success('Cliente cadastrado');
    setOpen(false);
    setStep(1);
    setForm({ name: '', cpf_cnpj: '', phone: '', whatsapp: '', email: '', address: '', notes: '' });
    load();
  };

  const filtered = clients.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.cpf_cnpj?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display">Clientes</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) setStep(1); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#00966d] hover:bg-[#007a58]">
              <Plus className="h-4 w-4 mr-2" /> Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <DialogTitle className="text-xl">Novo Cliente</DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    Etapa {step} de 2: {step === 1 ? 'Dados Pessoais' : 'Endereço e Notas'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <div className={`h-1.5 w-8 rounded-full ${step >= 1 ? 'bg-[#00966d]' : 'bg-gray-200'}`} />
                  <div className={`h-1.5 w-8 rounded-full ${step >= 2 ? 'bg-[#00966d]' : 'bg-gray-200'}`} />
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              {step === 1 && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Nome Completo</Label>
                    <Input 
                      placeholder=""
                      value={form.name} 
                      onChange={e => setForm({ ...form, name: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">CPF / CNPJ</Label>
                    <Input 
                      placeholder=""
                      value={form.cpf_cnpj} 
                      onChange={e => setForm({ ...form, cpf_cnpj: e.target.value })} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">E-mail</Label>
                      <Input 
                        type="email"
                        placeholder=""
                        value={form.email} 
                        onChange={e => setForm({ ...form, email: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Telefone</Label>
                      <Input 
                        placeholder=""
                        value={form.phone} 
                        onChange={e => setForm({ ...form, phone: e.target.value })} 
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Endereço</Label>
                    <Input 
                      placeholder=""
                      value={form.address} 
                      onChange={e => setForm({ ...form, address: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">WhatsApp (opcional)</Label>
                    <Input 
                      placeholder=""
                      value={form.whatsapp} 
                      onChange={e => setForm({ ...form, whatsapp: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Observações</Label>
                    <Textarea 
                      placeholder=""
                      className="min-h-[100px]"
                      value={form.notes} 
                      onChange={e => setForm({ ...form, notes: e.target.value })} 
                    />
                  </div>
                </>
              )}

              <div className="flex justify-between gap-3 mt-6">
                <Button variant="ghost" onClick={() => { if(step > 1) setStep(1); else setOpen(false); }}>
                  {step === 1 ? 'Cancelar' : 'Voltar'}
                </Button>
                
                {step === 1 ? (
                  <Button 
                    onClick={() => setStep(2)} 
                    className="bg-[#00966d] hover:bg-[#007a58] gap-2"
                  >
                    Próximo <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    onClick={save} 
                    className="bg-[#00966d] hover:bg-[#007a58]"
                  >
                    Finalizar Cadastro
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Input 
          placeholder="Buscar por nome, documento ou email..." 
          className="max-w-xl"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>NOME / DOCUMENTO</TableHead>
              <TableHead>CONTATO</TableHead>
              <TableHead>ENDEREÇO</TableHead>
              <TableHead className="text-right">AÇÕES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.cpf_cnpj}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{c.email}</div>
                  <div className="text-sm">{c.phone}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {c.address || '-'}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="link" className="text-emerald-600 h-auto p-0 text-xs">
                    Detalhes / Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  Nenhum cliente cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
