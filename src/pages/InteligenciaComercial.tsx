import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart3, Trophy, Users as UsersIcon, TrendingUp, TrendingDown, AlertTriangle,
  DollarSign, ShoppingCart, Calendar, Download, FileSpreadsheet, FileText, Sparkles, Activity
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend
} from 'recharts';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ---------- Helpers ----------
const VALID_STATUSES = new Set(
  ['approved', 'aprovado', 'entregue', 'faturado', 'liquidado'].map(s => s.toLowerCase())
);
const EXCLUDED_STATUSES = new Set(
  ['rejected', 'rejeitado', 'cancelled', 'cancelado', 'teste', 'arquivado', 'archived', 'draft'].map(s => s.toLowerCase())
);

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRLfull = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCompact = (v: number) => {
  if (!v) return 'R$ 0';
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace('.', ',')}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace('.', ',')}k`;
  return fmtBRL(v);
};
const daysBetween = (d: Date, ref = new Date()) =>
  Math.floor((ref.getTime() - d.getTime()) / 86400000);

interface QuoteRow {
  id: string;
  quote_number: string;
  client_id: string | null;
  client_name: string | null;
  salesperson: string | null;
  salesperson_id: string | null;
  created_by: string | null;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  total: number | null;
  approved_at: string | null;
  created_at: string;
  is_demonstration: boolean | null;
}
interface ClientRow {
  id: string;
  name: string | null;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  contact_phone: string | null;
  city: string | null;
  state: string | null;
  created_by: string | null;
}
interface ItemRow {
  quote_id: string;
  product_code: string | null;
  description: string | null;
  brand: string | null;
  model: string | null;
  quantity: number | null;
  total_price: number | null;
  line_total: number | null;
}

interface Aggregated {
  clientId: string;
  client: ClientRow | null;
  clientName: string;
  city: string;
  state: string;
  salesperson: string;
  quotesCount: number;
  totalValue: number;
  receivedValue: number;
  ticketMedio: number;
  firstPurchase: Date | null;
  lastPurchase: Date | null;
  daysSinceLast: number | null;
  intervalAvgDays: number | null;
  monthly: Record<string, number>;
  brands: Record<string, number>;
  products: Record<string, { qty: number; value: number; desc: string }>;
  isActive: boolean;
  isRecurrent: boolean;
  status: 'verde' | 'amarelo' | 'vermelho';
}

function getValue(q: QuoteRow): number {
  return Number(q.total_amount ?? q.total ?? 0);
}
function isCountable(q: QuoteRow): boolean {
  if (q.is_demonstration) return false;
  const s = (q.status || '').toLowerCase().trim();
  if (EXCLUDED_STATUSES.has(s)) return false;
  return VALID_STATUSES.has(s) || s === '';
}
function isReceived(q: QuoteRow): boolean {
  return (q.payment_status || '').toLowerCase() === 'liquidado';
}

export default function InteligenciaComercial() {
  const { user, isAdmin, isGestor } = useAuth();
  const canSeeAll = isAdmin || isGestor;

  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [clients, setClients] = useState<Record<string, ClientRow>>({});
  const [items, setItems] = useState<ItemRow[]>([]);

  // Filters
  const [period, setPeriod] = useState<'30' | '90' | '180' | '365' | 'all'>('all');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let qQuery = supabase
          .from('quotes')
          .select('id, quote_number, client_id, client_name, salesperson, salesperson_id, created_by, status, payment_status, total_amount, total, approved_at, created_at, is_demonstration')
          .order('created_at', { ascending: false })
          .limit(5000);

        if (!canSeeAll && user) qQuery = qQuery.eq('created_by', user.id);
        const { data: qData, error: qErr } = await qQuery;
        if (qErr) throw qErr;

        const valid = (qData || []).filter(isCountable);
        setQuotes(valid as QuoteRow[]);

        const clientIds = Array.from(new Set(valid.map((q: any) => q.client_id).filter(Boolean)));
        if (clientIds.length) {
          const { data: cData } = await supabase
            .from('clients')
            .select('id, name, company_name, contact_name, email, phone, contact_phone, city, state, created_by')
            .in('id', clientIds);
          const map: Record<string, ClientRow> = {};
          (cData || []).forEach((c: any) => { map[c.id] = c; });
          setClients(map);
        }

        const quoteIds = valid.map((q: any) => q.id);
        if (quoteIds.length) {
          // Chunk to avoid URL length limits
          const chunkSize = 200;
          const allItems: ItemRow[] = [];
          for (let i = 0; i < quoteIds.length; i += chunkSize) {
            const chunk = quoteIds.slice(i, i + chunkSize);
            const { data: iData } = await supabase
              .from('quote_items')
              .select('quote_id, product_code, description, brand, model, quantity, total_price, line_total')
              .in('quote_id', chunk);
            if (iData) allItems.push(...(iData as any));
          }
          setItems(allItems);
        }
      } catch (e: any) {
        console.error(e);
        toast.error('Erro ao carregar dados: ' + (e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [user, canSeeAll]);

  // ---------- Aggregations ----------
  const filteredQuotes = useMemo(() => {
    const now = Date.now();
    const days = period === 'all' ? Infinity : parseInt(period, 10);
    return quotes.filter(q => {
      const d = new Date(q.approved_at || q.created_at).getTime();
      if (days !== Infinity && now - d > days * 86400000) return false;
      if (sellerFilter !== 'all' && q.created_by !== sellerFilter) return false;
      const c = q.client_id ? clients[q.client_id] : null;
      if (cityFilter !== 'all' && (c?.city || '') !== cityFilter) return false;
      if (stateFilter !== 'all' && (c?.state || '') !== stateFilter) return false;
      return true;
    });
  }, [quotes, clients, period, sellerFilter, cityFilter, stateFilter]);

  const itemsByQuote = useMemo(() => {
    const m = new Map<string, ItemRow[]>();
    items.forEach(it => {
      if (!m.has(it.quote_id)) m.set(it.quote_id, []);
      m.get(it.quote_id)!.push(it);
    });
    return m;
  }, [items]);

  const aggregated: Aggregated[] = useMemo(() => {
    const map = new Map<string, Aggregated>();
    filteredQuotes.forEach(q => {
      const cid = q.client_id || `__${q.client_name || 'sem'}`;
      const c = q.client_id ? clients[q.client_id] || null : null;
      if (!map.has(cid)) {
        map.set(cid, {
          clientId: cid,
          client: c,
          clientName: c?.company_name || c?.name || q.client_name || 'Sem cliente',
          city: c?.city || '',
          state: c?.state || '',
          salesperson: q.salesperson || '',
          quotesCount: 0,
          totalValue: 0,
          receivedValue: 0,
          ticketMedio: 0,
          firstPurchase: null,
          lastPurchase: null,
          daysSinceLast: null,
          intervalAvgDays: null,
          monthly: {},
          brands: {},
          products: {},
          isActive: false,
          isRecurrent: false,
          status: 'vermelho',
        });
      }
      const a = map.get(cid)!;
      const val = getValue(q);
      const d = new Date(q.approved_at || q.created_at);
      a.quotesCount += 1;
      a.totalValue += val;
      if (isReceived(q)) a.receivedValue += val;
      if (!a.firstPurchase || d < a.firstPurchase) a.firstPurchase = d;
      if (!a.lastPurchase || d > a.lastPurchase) a.lastPurchase = d;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      a.monthly[key] = (a.monthly[key] || 0) + val;
      (itemsByQuote.get(q.id) || []).forEach(it => {
        const brand = it.brand || 'Sem marca';
        a.brands[brand] = (a.brands[brand] || 0) + Number(it.total_price ?? it.line_total ?? 0);
        const pk = it.product_code || it.description || 'item';
        if (!a.products[pk]) a.products[pk] = { qty: 0, value: 0, desc: it.description || pk };
        a.products[pk].qty += Number(it.quantity || 0);
        a.products[pk].value += Number(it.total_price ?? it.line_total ?? 0);
      });
    });
    const arr = Array.from(map.values()).map(a => {
      a.ticketMedio = a.quotesCount ? a.totalValue / a.quotesCount : 0;
      if (a.lastPurchase) a.daysSinceLast = daysBetween(a.lastPurchase);
      if (a.firstPurchase && a.lastPurchase && a.quotesCount > 1) {
        a.intervalAvgDays = Math.round(daysBetween(a.firstPurchase, a.lastPurchase) / (a.quotesCount - 1));
      }
      a.isActive = (a.daysSinceLast ?? 9999) <= 90;
      a.isRecurrent = a.quotesCount >= 2;
      const d = a.daysSinceLast ?? 9999;
      a.status = d <= 30 ? 'verde' : d <= 90 ? 'amarelo' : 'vermelho';
      return a;
    });
    return arr.sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredQuotes, clients, itemsByQuote]);

  const filteredAggregated = useMemo(() => {
    return aggregated.filter(a => {
      if (activeFilter === 'active' && !a.isActive) return false;
      if (activeFilter === 'inactive' && a.isActive) return false;
      if (brandFilter !== 'all' && !a.brands[brandFilter]) return false;
      if (search && !a.clientName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [aggregated, activeFilter, brandFilter, search]);

  // ---------- Dashboard KPIs ----------
  const kpis = useMemo(() => {
    const totalRevenue = filteredQuotes.reduce((s, q) => s + getValue(q), 0);
    const totalReceived = filteredQuotes.filter(isReceived).reduce((s, q) => s + getValue(q), 0);
    const totalClients = aggregated.length;
    const activeClients = aggregated.filter(a => a.isActive).length;
    const inactiveClients = totalClients - activeClients;
    const recurrent = aggregated.filter(a => a.isRecurrent).length;
    const avgPerClient = totalClients ? filteredQuotes.length / totalClients : 0;
    const avgQuote = filteredQuotes.length ? totalRevenue / filteredQuotes.length : 0;
    const ticketMedio = totalClients ? totalRevenue / totalClients : 0;
    return {
      totalRevenue, totalReceived, totalClients, activeClients, inactiveClients,
      recurrent, avgPerClient, avgQuote, ticketMedio,
    };
  }, [filteredQuotes, aggregated]);

  // ---------- Top products ----------
  const topProducts = useMemo(() => {
    const map = new Map<string, { desc: string; qty: number; value: number; clients: Set<string> }>();
    filteredQuotes.forEach(q => {
      (itemsByQuote.get(q.id) || []).forEach(it => {
        const k = it.product_code || it.description || 'item';
        if (!map.has(k)) map.set(k, { desc: it.description || k, qty: 0, value: 0, clients: new Set() });
        const e = map.get(k)!;
        e.qty += Number(it.quantity || 0);
        e.value += Number(it.total_price ?? it.line_total ?? 0);
        if (q.client_id) e.clients.add(q.client_id);
      });
    });
    return Array.from(map.entries())
      .map(([code, v]) => ({ code, ...v, clientsCount: v.clients.size }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [filteredQuotes, itemsByQuote]);

  // ---------- Evolution chart ----------
  const monthlySeries = useMemo(() => {
    const m: Record<string, number> = {};
    filteredQuotes.forEach(q => {
      const d = new Date(q.approved_at || q.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      m[k] = (m[k] || 0) + getValue(q);
    });
    return Object.entries(m).sort().map(([month, value]) => ({ month, value }));
  }, [filteredQuotes]);

  // ---------- Filter options ----------
  const sellers = useMemo(() => {
    const m = new Map<string, string>();
    quotes.forEach(q => {
      if (q.created_by) m.set(q.created_by, q.salesperson || 'Vendedor');
    });
    return Array.from(m.entries());
  }, [quotes]);
  const cities = useMemo(() => Array.from(new Set(Object.values(clients).map(c => c.city).filter(Boolean) as string[])).sort(), [clients]);
  const states = useMemo(() => Array.from(new Set(Object.values(clients).map(c => c.state).filter(Boolean) as string[])).sort(), [clients]);
  const brands = useMemo(() => {
    const s = new Set<string>();
    items.forEach(i => { if (i.brand) s.add(i.brand); });
    return Array.from(s).sort();
  }, [items]);

  // ---------- Alerts ----------
  const alerts = useMemo(() => {
    const out: { type: string; severity: 'high' | 'med' | 'low'; message: string; client: string }[] = [];
    aggregated.forEach(a => {
      if ((a.daysSinceLast ?? 0) >= 120) {
        out.push({ type: 'parado', severity: 'high', client: a.clientName,
          message: `Há ${a.daysSinceLast} dias sem comprar.` });
      }
      const months = Object.entries(a.monthly).sort();
      if (months.length >= 2) {
        const [, prev] = months[months.length - 2];
        const [, curr] = months[months.length - 1];
        if (curr > prev * 1.5 && prev > 0) {
          out.push({ type: 'crescimento', severity: 'low', client: a.clientName,
            message: `Aumentou compras em ${Math.round((curr / prev - 1) * 100)}%.` });
        } else if (curr < prev * 0.5 && curr > 0) {
          out.push({ type: 'reducao', severity: 'med', client: a.clientName,
            message: `Reduziu compras em ${Math.round((1 - curr / prev) * 100)}%.` });
        }
      }
      if ((a.daysSinceLast ?? 9999) <= 30 && a.quotesCount >= 2 && (a.intervalAvgDays ?? 0) > 60) {
        out.push({ type: 'retorno', severity: 'low', client: a.clientName,
          message: 'Voltou a comprar recentemente.' });
      }
    });
    return out.slice(0, 50);
  }, [aggregated]);

  // ---------- Export ----------
  const exportRows = () => filteredAggregated.map((a, i) => ({
    'Posição': i + 1,
    'Empresa': a.clientName,
    'Responsável': a.client?.contact_name || '',
    'Cidade': a.city,
    'Estado': a.state,
    'Compras': a.quotesCount,
    'Valor Total': a.totalValue,
    'Recebido': a.receivedValue,
    'Ticket Médio': a.ticketMedio,
    'Última Compra': a.lastPurchase?.toLocaleDateString('pt-BR') || '',
    'Dias sem Comprar': a.daysSinceLast ?? '',
    'Status': a.status,
  }));

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ranking');
    XLSX.writeFile(wb, 'inteligencia-comercial.xlsx');
  };
  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'inteligencia-comercial.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Ranking de Clientes — Inteligência Comercial', 14, 12);
    autoTable(doc, {
      startY: 18,
      head: [['#', 'Empresa', 'Cidade', 'Compras', 'Valor', 'Última', 'Status']],
      body: filteredAggregated.slice(0, 100).map((a, i) => [
        i + 1, a.clientName, a.city, a.quotesCount, fmtBRL(a.totalValue),
        a.lastPurchase?.toLocaleDateString('pt-BR') || '-', a.status,
      ]),
      styles: { fontSize: 8 },
    });
    doc.save('inteligencia-comercial.pdf');
  };

  // ---------- Selected client detail ----------
  const detail = useMemo(() => aggregated.find(a => a.clientId === selectedClient) || null, [aggregated, selectedClient]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const statusBadge = (s: 'verde' | 'amarelo' | 'vermelho') => {
    const map = {
      verde: { c: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30', l: '🟢 Frequente' },
      amarelo: { c: 'bg-amber-500/15 text-amber-700 border-amber-500/30', l: '🟡 Atenção' },
      vermelho: { c: 'bg-red-500/15 text-red-700 border-red-500/30', l: '🔴 Parado' },
    }[s];
    return <Badge variant="outline" className={map.c}>{map.l}</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" /> Inteligência Comercial
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Rankings, recompra e oportunidades baseadas no histórico real de vendas.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="h-4 w-4 mr-1" />PDF</Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-7 gap-3">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="180">Últimos 6 meses</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
                <SelectItem value="all">Todo período</SelectItem>
              </SelectContent>
            </Select>
            {canSeeAll && (
              <Select value={sellerFilter} onValueChange={setSellerFilter}>
                <SelectTrigger><SelectValue placeholder="Vendedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos vendedores</SelectItem>
                  {sellers.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas cidades</SelectItem>
                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos estados</SelectItem>
                {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas marcas</SelectItem>
                {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={(v: any) => setActiveFilter(v)}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ativos e inativos</SelectItem>
                <SelectItem value="active">Apenas ativos</SelectItem>
                <SelectItem value="inactive">Apenas inativos</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} />
          </CardContent>
        </Card>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
            <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
            <TabsTrigger value="ranking"><Trophy className="h-4 w-4 mr-1" />Ranking</TabsTrigger>
            <TabsTrigger value="top"><Sparkles className="h-4 w-4 mr-1" />Top Clientes</TabsTrigger>
            <TabsTrigger value="products"><ShoppingCart className="h-4 w-4 mr-1" />Produtos</TabsTrigger>
            <TabsTrigger value="evolution"><Activity className="h-4 w-4 mr-1" />Evolução</TabsTrigger>
            <TabsTrigger value="alerts"><AlertTriangle className="h-4 w-4 mr-1" />Alertas</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={DollarSign} label="Receita Comercial" value={fmtCompact(kpis.totalRevenue)} hint="Aprovados + Liquidados" />
              <KpiCard icon={DollarSign} label="Receita Recebida" value={fmtCompact(kpis.totalReceived)} hint="Apenas liquidados" />
              <KpiCard icon={UsersIcon} label="Clientes Ativos" value={String(kpis.activeClients)} hint="Compraram ≤90 dias" />
              <KpiCard icon={UsersIcon} label="Clientes Inativos" value={String(kpis.inactiveClients)} hint=">90 dias sem comprar" />
              <KpiCard icon={ShoppingCart} label="Ticket Médio Cliente" value={fmtCompact(kpis.ticketMedio)} />
              <KpiCard icon={ShoppingCart} label="Valor Médio / Orçamento" value={fmtCompact(kpis.avgQuote)} />
              <KpiCard icon={TrendingUp} label="Compras / Cliente" value={kpis.avgPerClient.toFixed(1)} />
              <KpiCard icon={Trophy} label="Clientes Recorrentes" value={String(kpis.recurrent)} hint="2+ compras" />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Evolução de Receita</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={fmtCompact} width={80} />
                    <Tooltip formatter={(v: any) => fmtBRLfull(v)} />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ranking */}
          <TabsContent value="ranking">
            <Card>
              <CardHeader><CardTitle className="text-base">Ranking de Clientes ({filteredAggregated.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                      <TableHead>Última</TableHead>
                      <TableHead className="text-right">Dias</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAggregated.slice(0, 300).map((a, i) => (
                      <TableRow key={a.clientId} className="cursor-pointer" onClick={() => setSelectedClient(a.clientId)}>
                        <TableCell className="font-bold">{i + 1}</TableCell>
                        <TableCell className="font-medium">{a.clientName}</TableCell>
                        <TableCell>{a.client?.contact_name || '-'}</TableCell>
                        <TableCell>{a.city || '-'}{a.state ? ` / ${a.state}` : ''}</TableCell>
                        <TableCell className="text-right">{a.quotesCount}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtBRL(a.totalValue)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(a.ticketMedio)}</TableCell>
                        <TableCell>{a.lastPurchase?.toLocaleDateString('pt-BR') || '-'}</TableCell>
                        <TableCell className="text-right">{a.daysSinceLast ?? '-'}</TableCell>
                        <TableCell>{statusBadge(a.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top */}
          <TabsContent value="top" className="grid md:grid-cols-2 gap-4">
            <TopList title="Top 10 — Faturamento" items={[...filteredAggregated].slice(0, 10).map(a => ({ name: a.clientName, value: fmtBRL(a.totalValue) }))} onClick={n => setSelectedClient(aggregated.find(a => a.clientName === n)?.clientId || null)} />
            <TopList title="Top 10 — Quantidade de Compras" items={[...filteredAggregated].sort((a, b) => b.quotesCount - a.quotesCount).slice(0, 10).map(a => ({ name: a.clientName, value: `${a.quotesCount} compras` }))} onClick={n => setSelectedClient(aggregated.find(a => a.clientName === n)?.clientId || null)} />
            <TopList title="Top 10 — Maior Ticket Médio" items={[...filteredAggregated].sort((a, b) => b.ticketMedio - a.ticketMedio).slice(0, 10).map(a => ({ name: a.clientName, value: fmtBRL(a.ticketMedio) }))} onClick={n => setSelectedClient(aggregated.find(a => a.clientName === n)?.clientId || null)} />
            <TopList title="Top 10 — Recorrentes" items={[...filteredAggregated].filter(a => a.isRecurrent).sort((a, b) => b.quotesCount - a.quotesCount).slice(0, 10).map(a => ({ name: a.clientName, value: `${a.quotesCount}x — ${fmtBRL(a.totalValue)}` }))} onClick={n => setSelectedClient(aggregated.find(a => a.clientName === n)?.clientId || null)} />
          </TabsContent>

          {/* Products */}
          <TabsContent value="products">
            <Card>
              <CardHeader><CardTitle className="text-base">Produtos Mais Vendidos</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Qtd Vendida</TableHead>
                      <TableHead className="text-right">Valor Vendido</TableHead>
                      <TableHead className="text-right">Clientes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.map((p, i) => (
                      <TableRow key={p.code}>
                        <TableCell className="font-bold">{i + 1}</TableCell>
                        <TableCell className="font-medium max-w-md truncate">{p.desc}</TableCell>
                        <TableCell className="font-mono text-xs">{p.code}</TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtBRL(p.value)}</TableCell>
                        <TableCell className="text-right">{p.clientsCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Evolution */}
          <TabsContent value="evolution">
            <Card>
              <CardHeader><CardTitle className="text-base">Compras por Mês</CardTitle></CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={fmtCompact} width={80} />
                    <Tooltip formatter={(v: any) => fmtBRLfull(v)} />
                    <Legend />
                    <Bar dataKey="value" name="Receita" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts */}
          <TabsContent value="alerts">
            <Card>
              <CardHeader><CardTitle className="text-base">Alertas Inteligentes</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {alerts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum alerta no momento.</p>}
                {alerts.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    {a.type === 'parado' && <TrendingDown className="h-5 w-5 text-red-500 mt-0.5" />}
                    {a.type === 'reducao' && <TrendingDown className="h-5 w-5 text-amber-500 mt-0.5" />}
                    {a.type === 'crescimento' && <TrendingUp className="h-5 w-5 text-emerald-500 mt-0.5" />}
                    {a.type === 'retorno' && <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.client}</p>
                      <p className="text-xs text-muted-foreground">{a.message}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Client detail */}
      <Sheet open={!!selectedClient} onOpenChange={o => !o && setSelectedClient(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.clientName}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Responsável" value={detail.client?.contact_name || '-'} />
                  <Info label="Telefone" value={detail.client?.contact_phone || detail.client?.phone || '-'} />
                  <Info label="Email" value={detail.client?.email || '-'} />
                  <Info label="Cidade" value={`${detail.city || '-'}${detail.state ? '/' + detail.state : ''}`} />
                  <Info label="Primeira Compra" value={detail.firstPurchase?.toLocaleDateString('pt-BR') || '-'} />
                  <Info label="Última Compra" value={detail.lastPurchase?.toLocaleDateString('pt-BR') || '-'} />
                  <Info label="Total de Compras" value={String(detail.quotesCount)} />
                  <Info label="Valor Total" value={fmtBRLfull(detail.totalValue)} />
                  <Info label="Recebido" value={fmtBRLfull(detail.receivedValue)} />
                  <Info label="Ticket Médio" value={fmtBRLfull(detail.ticketMedio)} />
                  <Info label="Vendedor" value={detail.salesperson || '-'} />
                  <Info label="Status" value={detail.status} />
                </div>

                <div>
                  <p className="font-semibold mb-2 flex items-center gap-1"><ShoppingCart className="h-4 w-4" />Produtos mais comprados</p>
                  <div className="space-y-1">
                    {Object.entries(detail.products).sort((a, b) => b[1].value - a[1].value).slice(0, 8).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs border-b py-1">
                        <span className="truncate flex-1 pr-2">{v.desc}</span>
                        <span className="font-medium">{v.qty}x — {fmtBRL(v.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold mb-2">Marcas mais compradas</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(detail.brands).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b, v]) => (
                      <Badge key={b} variant="secondary">{b}: {fmtBRL(v)}</Badge>
                    ))}
                  </div>
                </div>

                {detail.intervalAvgDays != null && (
                  <div className="p-3 rounded-lg bg-muted/50 text-xs">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Intervalo médio entre compras: <strong>{detail.intervalAvgDays} dias</strong>.
                    {detail.lastPurchase && (
                      <> Próxima compra estimada: <strong>
                        {new Date(detail.lastPurchase.getTime() + detail.intervalAvgDays * 86400000).toLocaleDateString('pt-BR')}
                      </strong>.</>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

function KpiCard({ icon: Icon, label, value, hint }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
            <p className="text-lg md:text-xl font-bold font-display truncate">{value}</p>
            {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopList({ title, items, onClick }: { title: string; items: { name: string; value: string }[]; onClick?: (n: string) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 && <p className="text-xs text-muted-foreground">Sem dados.</p>}
        {items.map((it, i) => (
          <button key={i} onClick={() => onClick?.(it.name)}
            className="w-full flex items-center justify-between gap-2 p-2 rounded hover:bg-muted text-left">
            <span className="flex items-center gap-2 min-w-0">
              <Badge variant={i < 3 ? 'default' : 'secondary'} className="shrink-0">{i + 1}</Badge>
              <span className="truncate text-sm">{it.name}</span>
            </span>
            <span className="text-sm font-semibold shrink-0">{it.value}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  );
}
