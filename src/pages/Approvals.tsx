import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Check, X, UserCheck, ShieldCheck, ShieldAlert } from 'lucide-react';

const db = supabase as any;

export default function Approvals() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<any[]>([]);

  const load = async () => {
    const { data: approvalsData } = await db.from('user_approvals')
      .select('*')
      .order('created_at', { ascending: false });

    if (!approvalsData || approvalsData.length === 0) {
      setApprovals([]);
      return;
    }

    const userIds = approvalsData.map((a: any) => a.user_id);

    const [{ data: profilesData }, { data: rolesData }] = await Promise.all([
      db.from('profiles').select('user_id, full_name, phone, role, active').in('user_id', userIds),
      db.from('user_roles').select('user_id, role').in('user_id', userIds),
    ]);

    const profileMap = (profilesData || []).reduce((acc: any, p: any) => { acc[p.user_id] = p; return acc; }, {});
    const roleMap = (rolesData || []).reduce((acc: any, r: any) => { acc[r.user_id] = r.role; return acc; }, {});

    const merged = approvalsData.map((a: any) => ({
      ...a,
      profiles: profileMap[a.user_id] || null,
      system_role: roleMap[a.user_id] || 'user',
    }));
    setApprovals(merged);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (approval: any) => {
    const { error } = await db.from('user_approvals')
      .update({ status: 'approved', approved_by: user?.id })
      .eq('id', approval.id);
    if (error) toast.error(error.message);
    else { toast.success('Usuário aprovado!'); load(); }
  };

  const handleReject = async (approval: any) => {
    const { error } = await db.from('user_approvals')
      .update({ status: 'rejected', approved_by: user?.id })
      .eq('id', approval.id);
    if (error) toast.error(error.message);
    else { toast.success('Usuário rejeitado'); load(); }
  };

  const handleRoleChange = async (approval: any, newRole: string) => {
    // Update profile role label
    await db.from('profiles').update({ role: newRole === 'gestor' ? 'gestor' : 'comercial' }).eq('user_id', approval.user_id);

    // Update or insert system role
    if (newRole === 'gestor') {
      const { data: existing } = await db.from('user_roles').select('id').eq('user_id', approval.user_id).maybeSingle();
      if (existing) {
        await db.from('user_roles').update({ role: 'gestor' }).eq('user_id', approval.user_id);
      } else {
        await db.from('user_roles').insert({ user_id: approval.user_id, role: 'gestor' });
      }
    } else {
      // comercial = remove gestor role, keep as 'user'
      const { data: existing } = await db.from('user_roles').select('id, role').eq('user_id', approval.user_id).maybeSingle();
      if (existing && existing.role !== 'admin') {
        await db.from('user_roles').delete().eq('id', existing.id);
      }
    }

    toast.success(`Nível alterado para ${newRole === 'gestor' ? 'Gestor' : 'Comercial'}`);
    load();
  };

  const handleToggleActive = async (approval: any) => {
    const currentActive = approval.profiles?.active !== false;
    const newActive = !currentActive;

    const { error } = await db.from('profiles').update({ active: newActive }).eq('user_id', approval.user_id);
    if (error) { toast.error(error.message); return; }

    if (!newActive) {
      await db.from('user_approvals').update({ status: 'rejected' }).eq('user_id', approval.user_id);
    } else {
      await db.from('user_approvals').update({ status: 'approved' }).eq('user_id', approval.user_id);
    }

    toast.success(newActive ? 'Usuário ativado' : 'Usuário desativado');
    load();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      pending: { label: 'Pendente', variant: 'secondary' },
      approved: { label: 'Aprovado', variant: 'default' },
      rejected: { label: 'Rejeitado', variant: 'destructive' },
    };
    const s = map[status] || map.pending;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <UserCheck className="h-7 w-7 text-accent" /> Aprovações e Permissões
        </h1>
        <p className="text-muted-foreground">Gerencie acessos, níveis e status dos usuários</p>
      </div>

      <Card className="shadow-card">
        <CardContent className="pt-6">
          {approvals.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3">Nenhuma solicitação</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map((a: any) => {
                  const isAdmin = a.system_role === 'admin';
                  const currentRole = isAdmin ? 'admin' : (a.system_role === 'gestor' ? 'gestor' : 'comercial');
                  const isActive = a.profiles?.active !== false;

                  return (
                    <TableRow key={a.id} className={!isActive ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isAdmin && <ShieldCheck className="h-4 w-4 text-primary" />}
                          <span className="font-medium">{a.profiles?.full_name || 'Sem nome'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{a.profiles?.phone || '-'}</TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20">Admin</Badge>
                        ) : (
                          <Select value={currentRole} onValueChange={v => handleRoleChange(a, v)}>
                            <SelectTrigger className="w-[130px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="comercial">Comercial</SelectItem>
                              <SelectItem value="gestor">Gestor</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell>
                        {!isAdmin && (
                          <Switch checked={isActive} onCheckedChange={() => handleToggleActive(a)} />
                        )}
                      </TableCell>
                      <TableCell>{new Date(a.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        {a.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleApprove(a)}
                              className="text-accent hover:text-accent">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleReject(a)}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
