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
  const [form, setForm] = useState<any>({ 
    name: '', 
    cpf_cnpj: '', 
    phone: '', 
    whatsapp: '', 
    email: '', 
    address: '', 
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes Técnicos</h1>
          <p className="text-sm text-muted-foreground">Cadastro de clientes da assistência</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) setStep(1); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button></DialogTrigger>
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
                  <div className={`h-1.5 w-6 rounded-full ${step >= 1 ? 'bg-emerald-600' : 'bg-gray-200'}`} />
                  <div className={`h-1.5 w-6 rounded-full ${step >= 2 ? 'bg-emerald-600' : 'bg-gray-200'}`} />
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              {step === 1 && (
                <>
                  <div className="space-y-1.5">
                    <Label>Nome Completo</Label>
                    <Input 
                      placeholder="Ex: João Silva"
                      value={form.name} 
                      onChange={e => setForm({ ...form, name: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPF / CNPJ</Label>
                    <Input 
                      placeholder="000.000.000-00"
                      value={form.cpf_cnpj} 
                      onChange={e => setForm({ ...form, cpf_cnpj: e.target.value })} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>E-mail</Label>
                      <Input 
                        type="email"
                        placeholder="email@exemplo.com"
                        value={form.email} 
                        onChange={e => setForm({ ...form, email: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefone</Label>
                      <Input 
                        placeholder="(00) 00000-0000"
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
                    <Label>Endereço</Label>
                    <Input 
                      placeholder="Rua, número, bairro..."
                      value={form.address} 
                      onChange={e => setForm({ ...form, address: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>WhatsApp (opcional)</Label>
                    <Input 
                      placeholder="(00) 00000-0000"
                      value={form.whatsapp} 
                      onChange={e => setForm({ ...form, whatsapp: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea 
                      placeholder="Informações adicionais..."
                      className="min-h-[100px]"
                      value={form.notes} 
                      onChange={e => setForm({ ...form, notes: e.target.value })} 
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 mt-6">
                {step === 1 ? (
                  <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                  </Button>
                )}
                
                {step === 1 ? (
                  <Button 
                    onClick={() => setStep(2)} 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    Próximo <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    onClick={save} 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    Salvar Cliente
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{clients.length} cliente(s)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.cpf_cnpj}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>{c.email}</TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum cliente cadastrado</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
