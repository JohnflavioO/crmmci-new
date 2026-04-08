import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Users, Trophy, TrendingUp } from 'lucide-react';

const db = supabase as any;

const COLORS = ['#15AFA1', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatCompact = (v: number) => {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `R$ ${v.toFixed(0)}`;
};

interface Props {
  dateRange: { from: Date; to: Date };
}

interface SellerStats {
  user_id: string;
  name: string;
  total: number;
  approved: number;
  rejected: number;
  inNegotiation: number;
  revenue: number;
  lost: number;
  inNegotiationValue: number;
  conversionRate: number;
  avgTicket: number;
}

export default function SellerComparison({ dateRange }: Props) {
  const [sellers, setSellers] = useState<{ user_id: string; full_name: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allQuotes, setAllQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await db.from('profiles').select('user_id, full_name, role');
      setSellers(data || []);
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedIds.length === 0) { setAllQuotes([]); return; }
    const load = async () => {
      setLoading(true);
      const { data } = await db.from('quotes')
        .select('id, total, total_amount, status, created_by, quote_date')
        .gte('quote_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('quote_date', format(dateRange.to, 'yyyy-MM-dd'))
        .in('created_by', selectedIds);
      setAllQuotes(data || []);
      setLoading(false);
    };
    load();
  }, [selectedIds, dateRange]);

  const toggleSeller = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === sellers.length) setSelectedIds([]);
    else setSelectedIds(sellers.map(s => s.user_id));
  };

  const stats: SellerStats[] = useMemo(() => {
    return selectedIds.map(id => {
      const seller = sellers.find(s => s.user_id === id);
      const sq = allQuotes.filter(q => q.created_by === id);
      const approved = sq.filter(q => q.status === 'approved');
      const rejected = sq.filter(q => q.status === 'rejected');
      const inNeg = sq.filter(q => !['approved', 'rejected'].includes(q.status));
      const revenue = approved.reduce((s: number, q: any) => s + (q.total_amount || q.total || 0), 0);
      const lost = rejected.reduce((s: number, q: any) => s + (q.total_amount || q.total || 0), 0);
      const inNegVal = inNeg.reduce((s: number, q: any) => s + (q.total_amount || q.total || 0), 0);
      return {
        user_id: id,
        name: seller?.full_name || 'Desconhecido',
        total: sq.length,
        approved: approved.length,
        rejected: rejected.length,
        inNegotiation: inNeg.length,
        revenue,
        lost,
        inNegotiationValue: inNegVal,
        conversionRate: sq.length > 0 ? (approved.length / sq.length) * 100 : 0,
        avgTicket: approved.length > 0 ? revenue / approved.length : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [selectedIds, allQuotes, sellers]);

  const chartData = useMemo(() => {
    return stats.map(s => ({
      name: s.name.split(' ')[0],
      Vendido: s.revenue,
      Perdido: s.lost,
      'Em Negociação': s.inNegotiationValue,
    }));
  }, [stats]);

  const conversionChartData = useMemo(() => {
    return stats.map(s => ({
      name: s.name.split(' ')[0],
      'Taxa (%)': Number(s.conversionRate.toFixed(1)),
      'Ticket Médio': s.avgTicket,
    }));
  }, [stats]);

  const topSeller = stats.length > 0 ? stats[0] : null;

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm md:text-base flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" /> Comparativo de Vendedores
        </CardTitle>
        <p className="text-xs text-muted-foreground">Selecione os vendedores para comparar performance</p>
      </CardHeader>
      <CardContent>
        {/* Seller selection */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Button
              variant={selectedIds.length === sellers.length ? 'default' : 'outline'}
              size="sm"
              onClick={selectAll}
              className="min-h-[36px] text-xs"
            >
              {selectedIds.length === sellers.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </Button>
            <span className="text-xs text-muted-foreground">{selectedIds.length} selecionado(s)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sellers.map((s, i) => (
              <label
                key={s.user_id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-all ${
                  selectedIds.includes(s.user_id)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={selectedIds.includes(s.user_id)}
                  onCheckedChange={() => toggleSeller(s.user_id)}
                  className="h-3.5 w-3.5"
                />
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                {s.full_name}
              </label>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && selectedIds.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Selecione pelo menos um vendedor para comparar
          </div>
        )}

        {!loading && stats.length > 0 && (
          <>
            {/* Top performer highlight */}
            {topSeller && stats.length > 1 && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3">
                <Trophy className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">{topSeller.name}</p>
                  <p className="text-xs text-amber-700">
                    Melhor performance: {formatCurrency(topSeller.revenue)} em vendas • {topSeller.conversionRate.toFixed(1)}% conversão
                  </p>
                </div>
              </div>
            )}

            {/* Comparison table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Vendedor</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Criadas</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Vendidas</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Perdidas</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Em Negoc.</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Receita</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Ticket Médio</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={s.user_id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-2 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[selectedIds.indexOf(s.user_id) % COLORS.length] }} />
                        <span className="font-medium text-xs">{s.name}</span>
                        {i === 0 && stats.length > 1 && <Trophy className="h-3 w-3 text-amber-500" />}
                      </td>
                      <td className="text-right py-2 px-2 text-xs">{s.total}</td>
                      <td className="text-right py-2 px-2 text-xs text-emerald-600 font-medium">{s.approved}</td>
                      <td className="text-right py-2 px-2 text-xs text-red-500">{s.rejected}</td>
                      <td className="text-right py-2 px-2 text-xs text-amber-600">{s.inNegotiation}</td>
                      <td className="text-right py-2 px-2 text-xs font-medium">{formatCurrency(s.revenue)}</td>
                      <td className="text-right py-2 px-2 text-xs">{formatCurrency(s.avgTicket)}</td>
                      <td className="text-right py-2 px-2 text-xs">
                        <span className={s.conversionRate >= 50 ? 'text-emerald-600 font-medium' : 'text-amber-600'}>
                          {s.conversionRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Receita por Vendedor
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => formatCompact(v)} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Vendido" fill="#15AFA1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Perdido" fill="#EF4444" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Em Negociação" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5" /> Taxa de Conversão (%)
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={conversionChartData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Taxa (%)" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
