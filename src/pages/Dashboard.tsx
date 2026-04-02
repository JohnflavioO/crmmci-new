import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Users, DollarSign, TrendingUp, Clock, CheckCircle, XCircle, BarChart3, CreditCard, QrCode, FileBarChart, CircleDot, CheckCircle2 } from 'lucide-react';

const statusLabels: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviado', approved: 'Aprovado', rejected: 'Rejeitado',
};
const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary', sent: 'default', approved: 'default', rejected: 'destructive',
};

const db = supabase as any;

const paymentMethodIcons: Record<string, { label: string; icon: any }> = {
  pix: { label: 'PIX', icon: QrCode },
  cartao: { label: 'Cartão', icon: CreditCard },
  boleto: { label: 'Boleto', icon: FileBarChart },
};

const paymentStatusConfig: Record<string, { label: string; icon: any; className: string }> = {
  pendente: { label: 'Pendente', icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  em_andamento: { label: 'Em andamento', icon: CircleDot, className: 'bg-blue-100 text-blue-800 border-blue-200' },
  liquidado: { label: 'Liquidado', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

export default function Dashboard() {
  const { isGestor } = useAuth();
  const [stats, setStats] = useState({ quotes: 0, clients: 0, totalValue: 0, approved: 0, pending: 0, rejected: 0, avgTicket: 0, products: 0 });
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [quotesRes, clientsRes, recentRes, productsRes] = await Promise.all([
        db.from('quotes').select('status, total_amount, client_id, clients(company_name)'),
        db.from('clients').select('id', { count: 'exact', head: true }),
        db.from('quotes').select('*, clients(company_name)')
          .order('created_at', { ascending: false }).limit(8),
        db.from('products').select('id', { count: 'exact', head: true }),
      ]);

      const quotes = quotesRes.data || [];
      const totalValue = quotes.reduce((sum: number, q: any) => sum + (parseFloat(q.total_amount) || 0), 0);
      const approved = quotes.filter((q: any) => q.status === 'approved').length;
      const pending = quotes.filter((q: any) => q.status === 'draft' || q.status === 'sent').length;
      const rejected = quotes.filter((q: any) => q.status === 'rejected').length;

      // Top clients by quote value
      const clientMap: Record<string, { name: string; total: number; count: number }> = {};
      quotes.forEach((q: any) => {
        if (q.client_id) {
          if (!clientMap[q.client_id]) clientMap[q.client_id] = { name: q.clients?.company_name || '', total: 0, count: 0 };
          clientMap[q.client_id].total += parseFloat(q.total_amount) || 0;
          clientMap[q.client_id].count++;
        }
      });
      const sorted = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 5);

      setStats({
        quotes: quotes.length,
        clients: clientsRes.count || 0,
        totalValue,
        approved,
        pending,
        rejected,
        avgTicket: quotes.length > 0 ? totalValue / quotes.length : 0,
        products: productsRes.count || 0,
      });
      setRecentQuotes(recentRes.data || []);
      setTopClients(sorted);
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Orçamentos" value={stats.quotes} icon={FileText} />
        <StatCard title="Clientes" value={stats.clients} icon={Users} />
        <StatCard title="Valor Total" value={formatCurrency(stats.totalValue)} icon={DollarSign} />
        <StatCard title="Ticket Médio" value={formatCurrency(stats.avgTicket)} icon={BarChart3} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Aprovados" value={stats.approved} icon={CheckCircle} className="border-l-4 border-l-green-500" />
        <StatCard title="Pendentes" value={stats.pending} icon={Clock} className="border-l-4 border-l-yellow-500" />
        <StatCard title="Rejeitados" value={stats.rejected} icon={XCircle} className="border-l-4 border-l-red-500" />
        <StatCard title="Produtos Cadastrados" value={stats.products} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-lg">Últimos Orçamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {recentQuotes.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhum orçamento criado ainda</p>
            ) : (
              <div className="space-y-2">
                {recentQuotes.map((q: any) => {
                  const pmConfig = paymentMethodIcons[q.payment_method];
                  const psConfig = paymentStatusConfig[q.payment_status] || paymentStatusConfig.pendente;
                  const PsIcon = psConfig.icon;
                  return (
                    <div key={q.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{q.quote_number}</p>
                        <p className="text-xs text-muted-foreground">{q.clients?.company_name || 'Sem cliente'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {pmConfig && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <pmConfig.icon className="h-3 w-3" /> {pmConfig.label}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${psConfig.className}`}>
                          <PsIcon className="h-3 w-3" /> {psConfig.label}
                        </span>
                        <span className="text-sm font-medium">{formatCurrency(parseFloat(q.total_amount) || 0)}</span>
                        <Badge variant={statusVariants[q.status] || 'secondary'}
                          className={q.status === 'approved' ? 'bg-[hsl(168,80%,45%)] text-white border-[hsl(168,80%,45%)]' : ''}>
                          {statusLabels[q.status] || q.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-lg">Top Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {topClients.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{c.name || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground">{c.count} orçamento(s)</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
