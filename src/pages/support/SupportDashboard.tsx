import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Wrench, 
  FileText, 
  Package, 
  Users, 
  DollarSign, 
  Search, 
  Filter, 
  Plus, 
  Download,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';

const STATUSES = [
  { key: 'recebido', label: 'Recebidos', color: '#64748b', bg: 'bg-slate-500' },
  { key: 'diagnostico', label: 'Diagnóstico', color: '#3b82f6', bg: 'bg-blue-500' },
  { key: 'aguardando_aprovacao', label: 'Aguardando Aprovação', color: '#f59e0b', bg: 'bg-amber-500' },
  { key: 'aguardando_peca', label: 'Aguardando Peça', color: '#f97316', bg: 'bg-orange-500' },
  { key: 'em_reparo', label: 'Em Reparo', color: '#a855f7', bg: 'bg-purple-500' },
  { key: 'pronto', label: 'Pronto', color: '#10b981', bg: 'bg-emerald-500' },
  { key: 'entregue', label: 'Entregue', color: '#15803d', bg: 'bg-green-700' },
];

interface Stats {
  totalOS: number;
  faturamento: number;
  ticketMedio: number;
  totalPecas: number;
  byStatus: { name: string, value: number, color: string }[];
  recentes: any[];
}

export default function SupportDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ordersRes, productsRes, recentRes] = await Promise.all([
          supabase.from('technical_orders' as any).select('id,status,total_value'),
          supabase.from('technical_products' as any).select('id,quantity'),
          supabase.from('technical_orders' as any)
            .select('id,os_number,equipment,status,created_at,client_name,total_value')
            .order('created_at', { ascending: false })
            .limit(6),
        ]);

        const orders = (ordersRes.data || []) as any[];
        const products = (productsRes.data || []) as any[];
        
        const faturamento = orders.reduce((s, o) => s + Number(o.total_value || 0), 0);
        const ticketMedio = orders.length > 0 ? faturamento / orders.length : 0;
        
        const byStatusCount: Record<string, number> = {};
        orders.forEach(o => { byStatusCount[o.status] = (byStatusCount[o.status] || 0) + 1; });

        const chartData = STATUSES.map(s => ({
          name: s.label,
          value: byStatusCount[s.key] || 0,
          color: s.color
        })).filter(d => d.value > 0);

        setStats({
          totalOS: orders.length,
          faturamento,
          ticketMedio,
          totalPecas: products.reduce((s, p) => s + Number(p.quantity || 0), 0),
          byStatus: chartData,
          recentes: (recentRes.data || []) as any[],
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kpis = [
    { 
      title: 'Total de Ordens de Serviço', 
      value: stats?.totalOS ?? 0, 
      icon: FileText, 
      trend: '+12.5%', 
      isPositive: true,
      description: 'vs mês anterior'
    },
    { 
      title: 'Faturamento Técnico', 
      value: `R$ ${(stats?.faturamento ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 
      icon: DollarSign, 
      trend: '+5.2%', 
      isPositive: true,
      description: 'vs mês anterior'
    },
    { 
      title: 'Peças em Estoque', 
      value: stats?.totalPecas ?? 0, 
      icon: Package, 
      trend: '-2.1%', 
      isPositive: false,
      description: 'vs mês anterior'
    },
    { 
      title: 'Ticket Médio', 
      value: `R$ ${(stats?.ticketMedio ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 
      icon: TrendingUp, 
      trend: '+1.8%', 
      isPositive: true,
      description: 'vs mês anterior'
    },
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar OS, Cliente ou Técnico..." 
            className="pl-9 bg-white border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-slate-200">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" className="gap-2 border-slate-200">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white" asChild>
            <Link to="/suporte/os?new=true">
              <Plus className="h-4 w-4" />
              Nova OS
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <Card key={idx} className="border-border shadow-sm overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-muted rounded-lg">
                  <kpi.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${kpi.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {kpi.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {kpi.trend}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1">{kpi.value}</h3>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">{kpi.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Orders List */}
        <Card className="lg:col-span-2 border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-bold">Ordens de Serviço Recentes</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/90 hover:bg-primary/10" asChild>
              <Link to="/suporte/os">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-100 pb-2">
                    <th className="font-semibold text-slate-500 py-3 px-1">ID</th>
                    <th className="font-semibold text-slate-500 py-3 px-1">CLIENTE</th>
                    <th className="font-semibold text-slate-500 py-3 px-1">EQUIPAMENTO</th>
                    <th className="font-semibold text-slate-500 py-3 px-1">STATUS</th>
                    <th className="font-semibold text-slate-500 py-3 px-1">VALOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats?.recentes.map((o) => {
                    const status = STATUSES.find(s => s.key === o.status);
                    return (
                      <tr key={o.id} className="group hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => window.location.href = `/suporte/os/${o.id}`}>
                        <td className="py-4 px-1 font-medium text-slate-900">{o.os_number}</td>
                        <td className="py-4 px-1 text-slate-600">{o.client_name}</td>
                        <td className="py-4 px-1 text-slate-600 truncate max-w-[150px]">{o.equipment}</td>
                        <td className="py-4 px-1">
                          <Badge 
                            variant="secondary" 
                            className={`font-normal ${status?.bg || 'bg-slate-100'} text-white border-none`}
                          >
                            {status?.label || o.status}
                          </Badge>
                        </td>
                        <td className="py-4 px-1 font-semibold text-slate-900">
                          R$ {Number(o.total_value || 0).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    );
                  })}
                  {(!stats || stats.recentes.length === 0) && !loading && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 italic">
                        Nenhuma ordem de serviço encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution & Shortcuts */}
        <div className="space-y-6">
          <Card className="border-slate-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Status da Operação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.byStatus || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {(stats?.byStatus || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-2 mt-4">
                {STATUSES.slice(0, 4).map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${s.bg}`} />
                    <span className="text-[10px] text-slate-500 truncate uppercase font-semibold">{s.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-muted rounded-md">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <h4 className="font-semibold text-sm">Tempo Médio de Reparo</h4>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold tracking-tight">3.2</span>
                <span className="text-muted-foreground text-sm mb-1">dias</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-4 uppercase tracking-wider font-bold">Meta da Equipe: 2.5 dias</p>
              <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[70%]" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
