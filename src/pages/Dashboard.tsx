import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import FollowUpAlerts from '@/components/FollowUpAlerts';
import RevenueForecasting from '@/components/RevenueForecasting';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Users, DollarSign, TrendingUp, Clock, CheckCircle, XCircle, BarChart3, CreditCard, QrCode, FileBarChart, CircleDot, CheckCircle2, Plus, ClipboardList } from 'lucide-react';

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

interface SellerInfo {
  user_id: string;
  full_name: string;
  clients_count?: number;
  quotes_count?: number;
  total_value?: number;
  approved_count?: number;
  pending_count?: number;
  rejected_count?: number;
}

interface TopClientInfo {
  name: string;
  total: number;
  count: number;
}

function computeStats(quotes: any[]) {
  const totalValue = quotes.reduce((sum: number, q: any) => sum + (parseFloat(q.total_amount) || parseFloat(q.total) || 0), 0);
  const approved = quotes.filter((q: any) => q.status === 'approved').length;
  const pending = quotes.filter((q: any) => ['draft', 'sent', 'pre_venda', 'pre_sale', 'contato_feito', 'contact_made', 'negociacao', 'negotiation'].includes(q.status)).length;
  const rejected = quotes.filter((q: any) => q.status === 'rejected').length;
  return {
    quotes: quotes.length,
    totalValue,
    approved,
    pending,
    rejected,
    avgTicket: quotes.length > 0 ? totalValue / quotes.length : 0,
  };
}

function computeTopClients(quotes: any[]) {
  const clientMap: Record<string, { name: string; total: number; count: number }> = {};
  quotes.forEach((q: any) => {
    if (q.client_id) {
      if (!clientMap[q.client_id]) clientMap[q.client_id] = { name: q.clients?.company_name || q.client_name || '', total: 0, count: 0 };
      clientMap[q.client_id].total += parseFloat(q.total_amount) || parseFloat(q.total) || 0;
      clientMap[q.client_id].count++;
    }
  });
  return Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 5);
}

export default function Dashboard() {
  const { user, isGestor, isAdmin } = useAuth();
  const navigate = useNavigate();
  const canSeeTeam = isGestor && !isAdmin;

  const [allQuotes, setAllQuotes] = useState<any[]>([]);
  const [myClientsCount, setMyClientsCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [sellers, setSellers] = useState<SellerInfo[]>([]);
  const [teamFilter, setTeamFilter] = useState('all');
  const [teamRecentQuotes, setTeamRecentQuotes] = useState<any[]>([]);
  const [teamTopClients, setTeamTopClients] = useState<TopClientInfo[]>([]);

  useEffect(() => {
    const loadOwnData = async () => {
      if (!user?.id) {
        setAllQuotes([]);
        setMyClientsCount(0);
        setProductsCount(0);
        return;
      }

      try {
        const [quotesRes, clientsRes, productsRes] = await Promise.all([
          db.from('quotes').select('*, clients(company_name)').eq('created_by', user.id).order('created_at', { ascending: false }),
          db.from('clients').select('id', { count: 'exact', head: true }).eq('created_by', user.id),
          db.from('products').select('id', { count: 'exact', head: true }),
        ]);

        if (quotesRes.error) console.error('[Dashboard] Quotes error:', quotesRes.error);
        if (clientsRes.error) console.error('[Dashboard] Clients error:', clientsRes.error);
        if (productsRes.error) console.error('[Dashboard] Products error:', productsRes.error);

        setAllQuotes(quotesRes.data || []);
        setMyClientsCount(clientsRes.count ?? 0);
        setProductsCount(productsRes.count ?? 0);
      } catch (err) {
        console.error('[Dashboard] loadOwnData error:', err);
      }
    };

    loadOwnData();
  }, [user?.id]);

  useEffect(() => {
    const loadTeamData = async () => {
      if (!canSeeTeam || !user?.id) {
        setSellers([]);
        setTeamRecentQuotes([]);
        setTeamTopClients([]);
        return;
      }

      const activeOwner = teamFilter === 'all' ? null : teamFilter;

      const [sellerStatsRes, recentRes, topClientsRes] = await Promise.all([
        db.rpc('get_team_dashboard_sellers'),
        db.rpc('get_team_dashboard_recent_quotes', { p_owner: activeOwner, p_limit: 500 }),
        db.rpc('get_team_dashboard_top_clients', { p_owner: activeOwner, p_limit: 5 }),
      ]);

      const sellerRows = (sellerStatsRes.data || []).filter((seller: any) => seller?.full_name);
      setSellers(sellerRows);
      setTeamRecentQuotes(recentRes.data || []);
      setTeamTopClients(
        ((topClientsRes.data || []) as any[]).map((client) => ({
          name: client.client_name || 'Sem nome',
          total: Number(client.total_value) || 0,
          count: Number(client.quotes_count) || 0,
        }))
      );
    };

    loadTeamData();
  }, [canSeeTeam, teamFilter, user?.id]);

  useEffect(() => {
    if (!canSeeTeam && teamFilter !== 'all') {
      setTeamFilter('all');
      return;
    }

    if (canSeeTeam && teamFilter !== 'all' && sellers.length > 0 && !sellers.some((seller) => seller.user_id === teamFilter)) {
      setTeamFilter('all');
    }
  }, [canSeeTeam, sellers, teamFilter]);

  const myQuotes = allQuotes; // already filtered by created_by = user.id in query
  const selectedTeamSellers = useMemo(
    () => (teamFilter === 'all' ? sellers : sellers.filter((seller) => seller.user_id === teamFilter)),
    [sellers, teamFilter],
  );

  const myStats = computeStats(myQuotes);
  const teamStats = useMemo(() => {
    const quotes = selectedTeamSellers.reduce((sum, seller) => sum + Number(seller.quotes_count || 0), 0);
    const totalValue = selectedTeamSellers.reduce((sum, seller) => sum + Number(seller.total_value || 0), 0);
    const approved = selectedTeamSellers.reduce((sum, seller) => sum + Number(seller.approved_count || 0), 0);
    const pending = selectedTeamSellers.reduce((sum, seller) => sum + Number(seller.pending_count || 0), 0);
    const rejected = selectedTeamSellers.reduce((sum, seller) => sum + Number(seller.rejected_count || 0), 0);

    return {
      quotes,
      totalValue,
      approved,
      pending,
      rejected,
      avgTicket: quotes > 0 ? totalValue / quotes : 0,
    };
  }, [selectedTeamSellers]);
  const teamClientsCount = useMemo(
    () => selectedTeamSellers.reduce((sum, seller) => sum + Number(seller.clients_count || 0), 0),
    [selectedTeamSellers],
  );
  const teamQuotes = teamRecentQuotes;
  const teamRecent = teamRecentQuotes.slice(0, 8);
  const myTopClients = computeTopClients(myQuotes);
  const myRecent = myQuotes.slice(0, 8);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const getSellerName = (userId: string) => {
    const s = sellers.find(s => s.user_id === userId);
    return s?.full_name || 'Desconhecido';
  };

  const renderQuoteRow = (q: any, showSeller = false) => {
    const pmConfig = paymentMethodIcons[q.payment_method];
    const psConfig = paymentStatusConfig[q.payment_status] || paymentStatusConfig.pendente;
    const PsIcon = psConfig.icon;
    const clientLabel = q.clients?.company_name || q.client_name || 'Sem cliente';
    return (
      <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/50 gap-2">
        <div>
          <p className="font-medium text-sm">{q.quote_number}</p>
          <p className="text-xs text-muted-foreground">
            {clientLabel}
            {showSeller && <span className="ml-2 text-xs opacity-60">• {getSellerName(q.created_by)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pmConfig && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <pmConfig.icon className="h-3 w-3" /> {pmConfig.label}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${psConfig.className}`}>
            <PsIcon className="h-3 w-3" /> {psConfig.label}
          </span>
          {parseFloat(q.shipping_cost) > 0 && (
            <span className="text-xs text-muted-foreground">Frete: {formatCurrency(parseFloat(q.shipping_cost))}</span>
          )}
          <span className="text-sm font-medium">{formatCurrency(parseFloat(q.total_amount) || 0)}</span>
          <Badge variant={statusVariants[q.status] || 'secondary'}
            className={q.status === 'approved' ? 'bg-[hsl(168,80%,45%)] text-white border-[hsl(168,80%,45%)]' : ''}>
            {statusLabels[q.status] || q.status}
          </Badge>
        </div>
      </div>
    );
  };

  const renderStatsBlock = (stats: any, clientsCount: number) => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-3 md:mb-4">
        <StatCard title="Total Orçamentos" value={stats.quotes} icon={FileText} />
        <StatCard title="Clientes" value={clientsCount} icon={Users} />
        <StatCard title="Valor Total" value={formatCurrency(stats.totalValue)} icon={DollarSign} />
        <StatCard title="Ticket Médio" value={formatCurrency(stats.avgTicket)} icon={BarChart3} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <StatCard title="Aprovados" value={stats.approved} icon={CheckCircle} className="border-l-4 border-l-green-500" />
        <StatCard title="Pendentes" value={stats.pending} icon={Clock} className="border-l-4 border-l-yellow-500" />
        <StatCard title="Rejeitados" value={stats.rejected} icon={XCircle} className="border-l-4 border-l-red-500" />
        <StatCard title="Produtos" value={productsCount} icon={TrendingUp} />
      </div>
    </>
  );

  // Simple dashboard for regular sellers
  if (!canSeeTeam) {
    return (
      <AppLayout>
        <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-display">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Visão geral do sistema</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => navigate('/reports')} className="gap-2 min-h-[44px] flex-1 sm:flex-initial border-primary text-primary hover:bg-primary/5">
              <ClipboardList className="h-4 w-4" /> Relatórios
            </Button>
            <Button onClick={() => navigate('/quotes')} className="gap-2 min-h-[44px] flex-1 sm:flex-initial">
              <Plus className="h-4 w-4" /> Criar Proposta
            </Button>
          </div>
        </div>
        {renderStatsBlock(myStats, myClientsCount)}
        <div className="mb-4 md:mb-6">
          <h2 className="text-lg font-bold font-display mb-3">Previsão de Faturamento</h2>
          <RevenueForecasting quotes={myQuotes} />
        </div>
        <div className="mb-4 md:mb-6">
          <FollowUpAlerts />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="shadow-card lg:col-span-2">
            <CardHeader><CardTitle className="font-display text-lg">Últimos Orçamentos</CardTitle></CardHeader>
            <CardContent>
              {myRecent.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Nenhum orçamento criado ainda</p>
              ) : (
                <div className="space-y-2">{myRecent.map(q => renderQuoteRow(q))}</div>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-display text-lg">Top Clientes</CardTitle></CardHeader>
            <CardContent>
              {myTopClients.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Sem dados</p>
              ) : (
                <div className="space-y-3">
                  {myTopClients.map((c, i) => (
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

  // Team dashboard for gestor
  return (
    <AppLayout>
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral dos seus resultados e do time</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/reports')} className="gap-2 min-h-[44px] border-primary text-primary hover:bg-primary/5">
            <ClipboardList className="h-4 w-4" /> Relatórios
          </Button>
          <Button onClick={() => navigate('/quotes')} className="gap-2 min-h-[44px]">
            <Plus className="h-4 w-4" /> Criar Proposta
          </Button>
          <div className="w-full sm:w-56">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Filtrar Time" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Vendedores</SelectItem>
                {sellers.map(s => (
                  <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Meus Resultados - agora no topo */}
      <div className="mb-8">
        <div className="mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold font-display">Meus Resultados</h2>
          <p className="text-muted-foreground text-sm">Seus números pessoais</p>
        </div>

        {renderStatsBlock(myStats, myClientsCount)}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="shadow-card lg:col-span-2">
            <CardHeader><CardTitle className="font-display text-lg">Meus Últimos Orçamentos</CardTitle></CardHeader>
            <CardContent>
              {myRecent.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Nenhum orçamento criado ainda</p>
              ) : (
                <div className="space-y-2">{myRecent.map(q => renderQuoteRow(q))}</div>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-display text-lg">Meus Top Clientes</CardTitle></CardHeader>
            <CardContent>
              {myTopClients.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Sem dados</p>
              ) : (
                <div className="space-y-3">
                  {myTopClients.map((c, i) => (
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
      </div>

      {/* Dashboard do Time - agora abaixo */}
      <div className="border-t pt-6 md:pt-8">
        <div className="mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold font-display">Dashboard do Time</h2>
          <p className="text-muted-foreground text-sm">Visão geral de toda a equipe</p>
        </div>

        {renderStatsBlock(teamStats, teamClientsCount)}

        <div className="mb-4 md:mb-6">
          <h2 className="text-lg font-bold font-display mb-3">Previsão de Faturamento (Time)</h2>
          <RevenueForecasting quotes={teamQuotes} />
        </div>

        <div className="mb-4 md:mb-6">
          <FollowUpAlerts />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
          <Card className="shadow-card lg:col-span-2">
            <CardHeader><CardTitle className="font-display text-lg">Últimos Orçamentos — Time</CardTitle></CardHeader>
            <CardContent>
              {teamRecent.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Nenhum orçamento encontrado</p>
              ) : (
                <div className="space-y-2">{teamRecent.map(q => renderQuoteRow(q, true))}</div>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader><CardTitle className="font-display text-lg">Top Clientes — Time</CardTitle></CardHeader>
            <CardContent>
              {teamTopClients.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Sem dados</p>
              ) : (
                <div className="space-y-3">
                  {teamTopClients.map((c, i) => (
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
      </div>
    </AppLayout>
  );
}
