import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function SupportClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: '', cpf_cnpj: '', phone: '', whatsapp: '', email: '', address: '', notes: '' });

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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {(['name','cpf_cnpj','phone','whatsapp','email','address'] as const).map(k => (
                <div key={k}>
                  <Label className="capitalize">{k.replace('_', '/')}</Label>
                  <Input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
                </div>
              ))}
              <div>
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button onClick={save} className="w-full">Salvar</Button>
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
