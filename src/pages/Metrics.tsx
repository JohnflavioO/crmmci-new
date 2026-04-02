import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, FileText,
  CalendarDays, Target, ArrowUpRight, ArrowDownRight, Users,
} from 'lucide-react';

const db = supabase as any;

const COLORS = ['hsl(160,60%,45%)', 'hsl(220,70%,50%)', 'hsl(38,92%,50%)', 'hsl(0,72%,51%)', 'hsl(280,60%,50%)'];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v);

type Period = 'month' | '3months' | '6months' | 'custom';

export default function Metrics() {
  const { user, isGestor, profile } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customTo, setCustomTo] = useState<Date | undefined>(new Date());
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const [selectedSeller, setSelectedSeller] = useState('me');

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
    if (period === '3months') return { from: startOfMonth(subMonths(now, 2)), to: now };
    if (period === '6months') return { from: startOfMonth(subMonths(now, 5)), to: now };
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }, [period, customFrom, customTo]);

  useEffect(() => {
    const load = async () => {
      let query = db.from('quotes')
        .select('id, quote_number, client_name, total, total_amount, status, payment_status, payment_method, quote_date, created_by, salesperson')
        .gte('quote_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('quote_date', format(dateRange.to, 'yyyy-MM-dd'));

      if (!isGestor) {
        query = query.eq('created_by', user?.id);
      } else if (selectedSeller !== 'all' && selectedSeller !== 'me') {
        query = query.eq('created_by', selectedSeller);
      } else if (selectedSeller === 'me') {
        query = query.eq('created_by', user?.id);
      }

      const { data } = await query.order('quote_date', { ascending: true });
      setQuotes(data || []);
    };
    load();
  }, [dateRange, selectedSeller, user?.id, isGestor]);

  useEffect(() => {
    if (!isGestor) return;
    const loadSellers = async () => {
      const { data } = await db.from('profiles').select('user_id, full_name, role');
      setSalespeople(data || []);
    };
    loadSellers();
  }, [isGestor]);

  // KPIs
  const totalQuotes = quotes.length;
  const approved = quotes.filter(q => q.status === 'approved');
  const totalRevenue = approved.reduce((s: number, q: any) => s + (q.total_amount || q.total || 0), 0);
  const totalAll = quotes.reduce((s: number, q: any) => s + (q.total_amount || q.total || 0), 0);
  const avgTicket = approved.length > 0 ? totalRevenue / approved.length : 0;
  const conversionRate = totalQuotes > 0 ? (approved.length / totalQuotes) * 100 : 0;
  const liquidados = quotes.filter(q => q.payment_status === 'liquidado');
  const totalLiquidado = liquidados.reduce((s: number, q: any) => s + (q.total_amount || q.total || 0), 0);
  const pendentes = quotes.filter(q => q.status === 'approved' && q.payment_status !== 'liquidado');

  // Chart: revenue over time
  const revenueByDay = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayQuotes = quotes.filter(q => q.quote_date === dayStr && q.status === 'approved');
      return {
        date: format(day, 'dd/MM', { locale: ptBR }),
        valor: dayQuotes.reduce((s: number, q: any) => s + (q.total_amount || q.total || 0), 0),
        qtd: dayQuotes.length,
      };
    }).filter(d => d.valor > 0 || d.qtd > 0);
  }, [quotes, dateRange]);

  // Chart: status distribution
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    quotes.forEach(q => {
      const label = q.status === 'approved' ? 'Aprovado' : q.status === 'rejected' ? 'Rejeitado' : q.status === 'sent' ? 'Enviado' : 'Rascunho';
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [quotes]);

  // Chart: payment methods
  const paymentData = useMemo(() => {
    const map: Record<string, number> = {};
    approved.forEach(q => {
      const method = q.payment_method === 'pix' ? 'PIX' : q.payment_method === 'cartao' ? 'Cartão' : q.payment_method === 'boleto' ? 'Boleto' : 'Outros';
      map[method] = (map[method] || 0) + (q.total_amount || q.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [approved]);

  // Chart: weekly trend
  const weeklyTrend = useMemo(() => {
    try {
      const weeks = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to }, { weekStartsOn: 1 });
      return weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekQuotes = quotes.filter(q => {
          const d = parseISO(q.quote_date);
          return isWithinInterval(d, { start: weekStart, end: weekEnd });
        });
        const approvedWeek = weekQuotes.filter(q => q.status === 'approved');
        return {
          semana: `${format(weekStart, 'dd/MM')}`,
          orcamentos: weekQuotes.length,
          aprovados: approvedWeek.length,
          receita: approvedWeek.reduce((s: number, q: any) => s + (q.total_amount || q.total || 0), 0),
        };
      });
    } catch { return []; }
  }, [quotes, dateRange]);

  // Insights
  const insights = useMemo(() => {
    const list: { text: string; type: 'positive' | 'negative' | 'neutral'; icon: any }[] = [];
    if (conversionRate >= 50) list.push({ text: `Taxa de conversão excelente: ${conversionRate.toFixed(0)}%`, type: 'positive', icon: TrendingUp });
    else if (conversionRate > 0) list.push({ text: `Taxa de conversão: ${conversionRate.toFixed(0)}% — busque mais follow-ups`, type: 'negative', icon: TrendingDown });
    if (pendentes.length > 0) list.push({ text: `${pendentes.length} orçamento(s) aprovado(s) aguardando pagamento`, type: 'neutral', icon: Target });
    if (avgTicket > 0) list.push({ text: `Ticket médio: ${formatCurrency(avgTicket)}`, type: 'positive', icon: DollarSign });
    if (totalQuotes === 0) list.push({ text: 'Nenhum orçamento neste período. Hora de prospectar!', type: 'negative', icon: FileText });
    return list;
  }, [conversionRate, pendentes, avgTicket, totalQuotes]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm" style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' && p.value > 100 ? formatCurrency(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-accent" /> Métricas
          </h1>
          <p className="text-muted-foreground">Acompanhe seu desempenho de vendas</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isGestor && (
            <Select value={selectedSeller} onValueChange={setSelectedSeller}>
              <SelectTrigger className="w-[180px]"><Users className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Meus números</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                {salespeople.filter(s => s.user_id !== user?.id).map(s => (
                  <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="w-[160px]"><CalendarDays className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="3months">Últimos 3 meses</SelectItem>
              <SelectItem value="6months">Últimos 6 meses</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn(!customFrom && 'text-muted-foreground')}>
                    {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'De'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn(!customTo && 'text-muted-foreground')}>
                    {customTo ? format(customTo, 'dd/MM/yyyy') : 'Até'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="shadow-card border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Orçamentos</p>
            <p className="text-2xl font-bold">{totalQuotes}</p>
            <p className="text-xs text-muted-foreground">{approved.length} aprovados</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-l-4 border-l-accent">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Receita Aprovada</p>
            <p className="text-2xl font-bold text-accent">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(totalLiquidado)} liquidado</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Ticket Médio</p>
            <p className="text-2xl font-bold">{formatCurrency(avgTicket)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-l-4" style={{ borderLeftColor: conversionRate >= 50 ? 'hsl(160,60%,45%)' : 'hsl(38,92%,50%)' }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Taxa Conversão</p>
            <p className="text-2xl font-bold">{conversionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">{approved.length}/{totalQuotes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {insights.map((ins, i) => (
            <Card key={i} className={cn('shadow-card', ins.type === 'positive' ? 'border-l-4 border-l-accent' : ins.type === 'negative' ? 'border-l-4 border-l-destructive' : 'border-l-4 border-l-primary')}>
              <CardContent className="p-4 flex items-center gap-3">
                <ins.icon className={cn('h-5 w-5', ins.type === 'positive' ? 'text-accent' : ins.type === 'negative' ? 'text-destructive' : 'text-primary')} />
                <p className="text-sm">{ins.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue over time */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" /> Receita ao longo do tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueByDay}>
                  <defs>
                    <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160,60%,45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(160,60%,45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="valor" name="Receita" stroke="hsl(160,60%,45%)" fill="url(#colorValor)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Sem dados no período</div>
            )}
          </CardContent>
        </Card>

        {/* Weekly trend */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Evolução Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="orcamentos" name="Orçamentos" fill="hsl(220,70%,50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="aprovados" name="Aprovados" fill="hsl(160,60%,45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Sem dados no período</div>
            )}
          </CardContent>
        </Card>

        {/* Status pie */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Payment methods */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-accent" /> Receita por Forma de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={paymentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                  <XAxis type="number" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Receita" fill="hsl(160,60%,45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
