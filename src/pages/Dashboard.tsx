import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Users, DollarSign, TrendingUp } from 'lucide-react';

const statusLabels: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviado', approved: 'Aprovado', rejected: 'Rejeitado',
};
const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary', sent: 'default', approved: 'default', rejected: 'destructive',
};

const db = supabase as any;

export default function Dashboard() {
  const [stats, setStats] = useState({ quotes: 0, clients: 0, totalValue: 0, approved: 0 });
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [quotesRes, clientsRes, recentRes] = await Promise.all([
        db.from('quotes').select('status, total_amount'),
        db.from('clients').select('id', { count: 'exact', head: true }),
        db.from('quotes').select('*, clients(company_name)')
          .order('created_at', { ascending: false }).limit(5),
      ]);

      const quotes = quotesRes.data || [];
      const totalValue = quotes.reduce((sum: number, q: any) => sum + (parseFloat(q.total_amount) || 0), 0);
      const approved = quotes.filter((q: any) => q.status === 'approved').length;

      setStats({
        quotes: quotes.length,
        clients: clientsRes.count || 0,
        totalValue,
        approved,
      });
      setRecentQuotes(recentRes.data || []);
    };
    load();
  }, []);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Orçamentos" value={stats.quotes} icon={FileText} />
        <StatCard title="Clientes" value={stats.clients} icon={Users} />
        <StatCard title="Valor Total" value={formatCurrency(stats.totalValue)} icon={DollarSign} />
        <StatCard title="Aprovados" value={stats.approved} icon={TrendingUp} />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-lg">Últimos Orçamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {recentQuotes.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nenhum orçamento criado ainda</p>
          ) : (
            <div className="space-y-3">
              {recentQuotes.map((q: any) => (
                <div key={q.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">{q.quote_number}</p>
                    <p className="text-xs text-muted-foreground">{q.clients?.company_name || 'Sem cliente'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatCurrency(parseFloat(q.total_amount) || 0)}</span>
                    <Badge variant={statusVariants[q.status] || 'secondary'}>
                      {statusLabels[q.status] || q.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
