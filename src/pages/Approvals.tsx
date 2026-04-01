import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Check, X, UserCheck } from 'lucide-react';

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
    const { data: profilesData } = await db.from('profiles')
      .select('user_id, full_name, phone, role')
      .in('user_id', userIds);

    const profileMap = (profilesData || []).reduce((acc: any, p: any) => {
      acc[p.user_id] = p;
      return acc;
    }, {});

    const merged = approvalsData.map((a: any) => ({
      ...a,
      profiles: profileMap[a.user_id] || null,
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
        <h1 className="text-2xl font-bold font-display">Aprovações</h1>
        <p className="text-muted-foreground">Gerencie as solicitações de acesso</p>
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
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.profiles?.full_name || 'Sem nome'}</TableCell>
                    <TableCell>{a.profiles?.phone || '-'}</TableCell>
                    <TableCell>{a.profiles?.role || '-'}</TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell>{new Date(a.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      {a.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleApprove(a)}
                            className="text-success hover:text-success">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleReject(a)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
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
