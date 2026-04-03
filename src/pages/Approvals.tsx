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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Check, X, UserCheck, ShieldCheck, Trash2, RotateCcw } from 'lucide-react';

const db = supabase as any;

export default function Approvals() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('active');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

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
      db.from('profiles').select('user_id, full_name, phone, role, active, deleted_at').in('user_id', userIds),
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

  const activeUsers = approvals.filter(a => !a.profiles?.deleted_at);
  const trashedUsers = approvals.filter(a => !!a.profiles?.deleted_at);

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
    await db.from('profiles').update({ role: newRole === 'gestor' ? 'gestor' : 'comercial' }).eq('user_id', approval.user_id);

    if (newRole === 'gestor') {
      const { data: existing } = await db.from('user_roles').select('id').eq('user_id', approval.user_id).maybeSingle();
      if (existing) {
        await db.from('user_roles').update({ role: 'gestor' }).eq('user_id', approval.user_id);
      } else {
        await db.from('user_roles').insert({ user_id: approval.user_id, role: 'gestor' });
      }
    } else {
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

  const handleMoveToTrash = async () => {
    if (!deleteTarget || deleteConfirm !== 'EXCLUIR') return;
    
    const { error } = await db.from('profiles')
      .update({ deleted_at: new Date().toISOString(), active: false })
      .eq('user_id', deleteTarget.user_id);
    
    if (error) { toast.error(error.message); return; }

    await db.from('user_approvals').update({ status: 'rejected' }).eq('user_id', deleteTarget.user_id);

    toast.success('Conta movida para a lixeira');
    setDeleteTarget(null);
    setDeleteConfirm('');
    load();
  };

  const handleRestore = async (approval: any) => {
    const { error } = await db.from('profiles')
      .update({ deleted_at: null, active: true })
      .eq('user_id', approval.user_id);
    
    if (error) { toast.error(error.message); return; }

    await db.from('user_approvals').update({ status: 'approved' }).eq('user_id', approval.user_id);

    toast.success('Conta restaurada com sucesso');
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

  const renderUserRow = (a: any, isTrash = false) => {
    const isAdminUser = a.system_role === 'admin';
    const currentRole = isAdminUser ? 'admin' : (a.system_role === 'gestor' ? 'gestor' : 'comercial');
    const isActive = a.profiles?.active !== false;

    return (
      <TableRow key={a.id} className={!isActive ? 'opacity-50' : ''}>
        <TableCell>
          <div className="flex items-center gap-2">
            {isAdminUser && <ShieldCheck className="h-4 w-4 text-primary" />}
            <span className="font-medium">{a.profiles?.full_name || 'Sem nome'}</span>
          </div>
        </TableCell>
        <TableCell>{a.profiles?.phone || '-'}</TableCell>
        <TableCell>
          {isAdminUser ? (
            <Badge className="bg-primary/10 text-primary border-primary/20">Admin</Badge>
          ) : isTrash ? (
            <span className="text-sm text-muted-foreground capitalize">{currentRole}</span>
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
        {!isTrash && (
          <TableCell>
            {!isAdminUser && (
              <Switch checked={isActive} onCheckedChange={() => handleToggleActive(a)} />
            )}
          </TableCell>
        )}
        <TableCell>
          {isTrash && a.profiles?.deleted_at
            ? new Date(a.profiles.deleted_at).toLocaleDateString('pt-BR')
            : new Date(a.created_at).toLocaleDateString('pt-BR')
          }
        </TableCell>
        <TableCell>
          {isTrash ? (
            <Button size="icon" variant="ghost" onClick={() => handleRestore(a)} title="Restaurar">
              <RotateCcw className="h-4 w-4 text-accent" />
            </Button>
          ) : (
            <div className="flex gap-1">
              {a.status === 'pending' && (
                <>
                  <Button size="icon" variant="ghost" onClick={() => handleApprove(a)}
                    className="text-accent hover:text-accent">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleReject(a)}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
              {!isAdminUser && (
                <Button size="icon" variant="ghost" onClick={() => { setDeleteTarget(a); setDeleteConfirm(''); }} title="Excluir">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <UserCheck className="h-7 w-7 text-accent" /> Usuários e Permissões
        </h1>
        <p className="text-muted-foreground">Gerencie acessos, níveis e status dos usuários</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active">
            Ativos ({activeUsers.length})
          </TabsTrigger>
          <TabsTrigger value="trash">
            <Trash2 className="h-4 w-4 mr-1" /> Lixeira ({trashedUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card className="shadow-card">
            <CardContent className="pt-6">
              {activeUsers.length === 0 ? (
                <div className="text-center py-12">
                  <UserCheck className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="text-muted-foreground mt-3">Nenhum usuário</p>
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
                    {activeUsers.map(a => renderUserRow(a, false))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trash">
          <Card className="shadow-card">
            <CardContent className="pt-6">
              {trashedUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Trash2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="text-muted-foreground mt-3">Lixeira vazia</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Excluído em</TableHead>
                      <TableHead className="w-28">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trashedUsers.map(a => renderUserRow(a, true))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteConfirm(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja mover a conta de <strong>{deleteTarget?.profiles?.full_name}</strong> para a lixeira? 
              A conta será desativada e poderá ser restaurada depois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Digite <strong>EXCLUIR</strong> para confirmar:
            </p>
            <Input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="Digite EXCLUIR"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirm(''); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== 'EXCLUIR'}
              onClick={handleMoveToTrash}
            >
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
