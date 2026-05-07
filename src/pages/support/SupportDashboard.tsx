import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Wrench, FileText, Package, Users, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

const STATUSES = [
  { key: 'recebido', label: 'Recebidos', color: 'bg-slate-500' },
  { key: 'diagnostico', label: 'Diagnóstico', color: 'bg-blue-500' },
  { key: 'aguardando_aprovacao', label: 'Aguardando Aprovação', color: 'bg-amber-500' },
  { key: 'aguardando_peca', label: 'Aguardando Peça', color: 'bg-orange-500' },
  { key: 'em_reparo', label: 'Em Reparo', color: 'bg-purple-500' },
  { key: 'pronto', label: 'Pronto', color: 'bg-emerald-500' },
  { key: 'entregue', label: 'Entregue', color: 'bg-green-700' },
];

interface Stats {
  emReparo: number;
  pendentes: number;
  vendaPecas: number;
  clientesAtivos: number;
  totalPecas: number;
  byStatus: Record<string, number>;
  recentes: any[];
}

export default function SupportDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [ordersRes, productsRes, recentRes] = await Promise.all([
        supabase.from('technical_orders' as any).select('id,status,client_id,labor_value,parts_value,total_value'),
        supabase.from('technical_products' as any).select('id,quantity'),
        supabase.from('technical_orders' as any).select('id,os_number,equipment,status,created_at,client_name').order('created_at', { ascending: false }).limit(8),
      ]);
      const orders = (ordersRes.data || []) as any[];
      const products = (productsRes.data || []) as any[];
      const byStatus: Record<string, number> = {};
      orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
      setStats({
        emReparo: orders.filter(o => o.status === 'em_reparo').length,
        pendentes: orders.filter(o => o.status === 'aguardando_aprovacao').length,
        vendaPecas: orders.reduce((s, o) => s + Number(o.parts_value || 0), 0),
        clientesAtivos: new Set(orders.filter(o => !['entregue', 'cancelado'].includes(o.status)).map(o => o.client_id)).size,
        totalPecas: products.reduce((s, p) => s + Number(p.quantity || 0), 0),
        byStatus,
        recentes: (recentRes.data || []) as any[],
      });
    })();
  }, []);

  const cards = [
    { title: 'Em Manutenção', value: stats?.emReparo ?? 0, icon: Wrench, to: '/suporte/os?status=em_reparo' },
    { title: 'Orçamentos Pendentes', value: stats?.pendentes ?? 0, icon: FileText, to: '/suporte/os?status=aguardando_aprovacao' },
    { title: 'Vendas de Peças', value: `R$ ${(stats?.vendaPecas ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, to: '/suporte/relatorios' },
    { title: 'Clientes Ativos', value: stats?.clientesAtivos ?? 0, icon: Users, to: '/suporte/clientes' },
    { title: 'Peças Totais', value: stats?.totalPecas ?? 0, icon: Package, to: '/suporte/estoque' },
  ];

  const max = Math.max(1, ...STATUSES.map(s => stats?.byStatus[s.key] || 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Suporte Técnico</h1>
        <p className="text-sm text-muted-foreground">Visão geral da operação técnica</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <Link key={c.title} to={c.to}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <c.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">{c.title}</p>
                <p className="text-xl md:text-2xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Status dos Serviços</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {STATUSES.map(s => {
              const v = stats?.byStatus[s.key] || 0;
              return (
                <div key={s.key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{s.label}</span>
                    <span className="font-semibold">{v}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${s.color}`} style={{ width: `${(v / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Entradas recentes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats?.recentes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma OS ainda.</p>}
            {stats?.recentes.map(o => {
              const st = STATUSES.find(s => s.key === o.status);
              return (
                <Link key={o.id} to={`/suporte/os/${o.id}`} className="block p-3 rounded-lg border hover:bg-muted/50 transition">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{o.equipment || 'Sem equipamento'}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.os_number} · {o.client_name}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{st?.label || o.status}</Badge>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
