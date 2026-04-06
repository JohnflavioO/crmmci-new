import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Clock } from 'lucide-react';
import { format, differenceInDays, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

const db = supabase as any;

interface SellerInfo { user_id: string; full_name: string }

export default function Reports() {
  const { user, isGestor, isAdmin } = useAuth();
  const canSeeAll = isGestor || isAdmin;

  const [sellers, setSellers] = useState<SellerInfo[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string>('mine');
  const [quotes, setQuotes] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  useEffect(() => {
    if (canSeeAll) {
      db.from('profiles').select('user_id, full_name').eq('active', true).then(({ data }: any) => {
        setSellers((data || []) as SellerInfo[]);
      });
    }
  }, [canSeeAll]);

  useEffect(() => {
    const load = async () => {
      let query = db.from('quotes').select('*, clients(company_name), quote_items(quantity)');
      if (dateRange?.from) query = query.gte('created_at', dateRange.from.toISOString());
      if (dateRange?.to) {
        const end = new Date(dateRange.to);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }
      const { data } = await query;
      setQuotes(data || []);
    };
    load();
  }, [dateRange]);

  const filteredQuotes = useMemo(() => {
    if (!canSeeAll || selectedSeller === 'all') return quotes;
    if (selectedSeller === 'mine') return quotes.filter(q => q.created_by === user?.id);
    return quotes.filter(q => q.created_by === selectedSeller);
  }, [quotes, selectedSeller, canSeeAll, user?.id]);

  const stats = useMemo(() => {
    const created = filteredQuotes.length;
    const won = filteredQuotes.filter(q => q.status === 'approved');
    const lost = filteredQuotes.filter(q => q.status === 'rejected');
    const wonValue = won.reduce((s: number, q: any) => s + (parseFloat(q.total_amount) || 0), 0);
    const lostValue = lost.reduce((s: number, q: any) => s + (parseFloat(q.total_amount) || 0), 0);
    const avgTicket = won.length > 0 ? wonValue / won.length : 0;
    const totalUnits = won.reduce((s: number, q: any) => {
      return s + (q.quote_items || []).reduce((us: number, i: any) => us + (i.quantity || 0), 0);
    }, 0);

    const avgDaysToWin = won.length > 0
      ? won.reduce((s: number, q: any) => {
          const created = new Date(q.created_at);
          const approved = q.approved_at ? new Date(q.approved_at) : new Date(q.updated_at);
          return s + Math.max(differenceInDays(approved, created), 0);
        }, 0) / won.length
      : 0;

    const avgDaysToLose = lost.length > 0
      ? lost.reduce((s: number, q: any) => {
          const created = new Date(q.created_at);
          const rejected = q.rejected_at ? new Date(q.rejected_at) : new Date(q.updated_at);
          return s + Math.max(differenceInDays(rejected, created), 0);
        }, 0) / lost.length
      : 0;

    return { created, won: won.length, lost: lost.length, wonValue, lostValue, avgTicket, totalUnits, avgDaysToWin: Math.round(avgDaysToWin), avgDaysToLose: Math.round(avgDaysToLose) };
  }, [filteredQuotes]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const getSellerName = () => {
    if (selectedSeller === 'mine') return 'Meus';
    if (selectedSeller === 'all') return 'Todos';
    return sellers.find(s => s.user_id === selectedSeller)?.full_name || '';
  };

  const dateLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'dd/MM/yyyy')} – ${format(dateRange.to, 'dd/MM/yyyy')}`
    : 'Selecionar período';

  return (
    <AppLayout>
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold font-display">Relatório de Negociações</h1>
        <p className="text-muted-foreground text-sm">Análise de desempenho de vendas</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {canSeeAll && (
          <Select value={selectedSeller} onValueChange={setSelectedSeller}>
            <SelectTrigger className="min-h-[44px] w-full sm:w-56">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Vendedores</SelectItem>
              <SelectItem value="mine">Meus Resultados</SelectItem>
              {sellers.map(s => (
                <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-h-[44px] w-full sm:w-auto justify-start gap-2">
              <CalendarIcon className="h-4 w-4" />
              {dateLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              locale={ptBR}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Top stats row - green/pink like RD */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <Card className="border-l-4 border-l-emerald-400 bg-emerald-50/60">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-emerald-700">Negociações criadas</p>
            <p className="text-2xl font-bold text-emerald-900">{stats.created}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/60">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-emerald-700">Negociações vendidas</p>
            <p className="text-2xl font-bold text-emerald-900">{stats.won}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-400 bg-rose-50/60">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-rose-700">Negociações perdidas</p>
            <p className="text-2xl font-bold text-rose-900">{stats.lost}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium text-muted-foreground">Tempo médio até a venda</p>
              <Clock className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{stats.avgDaysToWin} <span className="text-sm font-normal text-muted-foreground">dias</span></p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium text-muted-foreground">Tempo médio até a perda</p>
              <Clock className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{stats.avgDaysToLose} <span className="text-sm font-normal text-muted-foreground">dias</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="bg-sky-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-sky-700">Valor vendido</p>
            <p className="text-xl font-bold text-sky-900">{formatCurrency(stats.wonValue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-sky-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-sky-700">Ticket médio</p>
            <p className="text-xl font-bold text-sky-900">{formatCurrency(stats.avgTicket)}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Unidades vendidas</p>
            <p className="text-xl font-bold">{stats.totalUnits}</p>
          </CardContent>
        </Card>
        <Card className="bg-rose-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-rose-700">Valor perdido</p>
            <p className="text-xl font-bold text-rose-900">{formatCurrency(stats.lostValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent quotes table */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-bold font-display mb-4">Detalhamento — {getSellerName()}</h2>
          {filteredQuotes.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhuma negociação no período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Nº</th>
                    <th className="pb-2 font-medium text-muted-foreground">Cliente</th>
                    <th className="pb-2 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Valor</th>
                    <th className="pb-2 font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.slice(0, 50).map((q: any) => (
                    <tr key={q.id} className="border-b last:border-0">
                      <td className="py-2">{q.quote_number}</td>
                      <td className="py-2">{q.clients?.company_name || q.client_name || '—'}</td>
                      <td className="py-2">
                        <Badge variant={q.status === 'approved' ? 'default' : q.status === 'rejected' ? 'destructive' : 'secondary'}
                          className={q.status === 'approved' ? 'bg-emerald-500 text-white' : ''}>
                          {q.status === 'approved' ? 'Vendido' : q.status === 'rejected' ? 'Perdido' : q.status === 'sent' ? 'Enviado' : 'Rascunho'}
                        </Badge>
                      </td>
                      <td className="py-2 text-right font-medium">{formatCurrency(parseFloat(q.total_amount) || 0)}</td>
                      <td className="py-2 text-muted-foreground">{q.created_at ? format(new Date(q.created_at), 'dd/MM/yyyy') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
