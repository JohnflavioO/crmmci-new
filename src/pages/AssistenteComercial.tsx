import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Compass, Clock, Target, TrendingUp, Users, FileText, Send, History, Star, Trash2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ToolResult = {
  entity?: string;
  columns?: string[];
  rows?: any[];
  count?: number;
  summary?: any;
  by_seller?: any;
};

type AssistantResponse = {
  answer: string;
  tool_used: string | null;
  result: ToolResult | null;
};

type ConversationRow = {
  id: string;
  question: string;
  answer: string | null;
  tool_used: string | null;
  result_json: ToolResult | null;
  is_favorite: boolean;
  created_at: string;
};

const suggestions = [
  'Quais clientes estão há mais de 180 dias sem comprar?',
  'Propostas em negociação acima de R$ 50 mil',
  'Métricas do mês (conversão, receita, ranking de vendedores)',
  'Follow-ups atrasados',
  'Clientes de São Paulo cadastrados este ano',
  'Orçamentos aprovados nos últimos 30 dias',
];

function formatValue(v: any, key: string) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number' && (key.includes('amount') || key.includes('total') || key.includes('revenue'))) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    try { return format(new Date(v), 'dd/MM/yyyy', { locale: ptBR }); } catch { return v; }
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function columnLabel(c: string) {
  const map: Record<string, string> = {
    company_name: 'Empresa', name: 'Nome', city: 'Cidade', state: 'UF', email: 'E-mail', phone: 'Telefone',
    quote_number: 'Orçamento', client_name: 'Cliente', total_amount: 'Valor', status: 'Status', created_at: 'Criado em',
    title: 'Tarefa', due_date: 'Vencimento',
  };
  return map[c] || c;
}

export default function AssistenteComercial() {
  const { user, profile } = useAuth();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [history, setHistory] = useState<ConversationRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [drawerCard, setDrawerCard] = useState<null | { title: string; type: string }>(null);
  const [kpis, setKpis] = useState({
    overdueFollowups: 0,
    inactiveClients: 0,
    negotiating: 0,
    forecastRevenue: 0,
    approvedMonth: 0,
    conversion: 0,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const g = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const name = profile?.full_name?.split(' ')[0] || '';
    return name ? `${g}, ${name}.` : `${g}.`;
  }, [profile?.full_name]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const cutoff180 = new Date(Date.now() - 180 * 86400000).toISOString();

      const [{ data: overdueTasks }, { data: inactive }, { data: negotiating }, { data: approved }, { data: monthQuotes }] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: false }).lt('due_date', now.toISOString()).neq('status', 'done').limit(1000),
        supabase.from('clients').select('id').or(`last_purchase_date.lt.${cutoff180},last_purchase_date.is.null`).limit(1000),
        supabase.from('quotes').select('id, total_amount, total').in('status', ['negotiation', 'negociacao', 'sent']).limit(1000),
        supabase.from('quotes').select('id').eq('status', 'approved').gte('created_at', startMonth).limit(1000),
        supabase.from('quotes').select('id, status, total_amount, total').gte('created_at', startMonth).limit(2000),
      ]);

      const forecast = (negotiating || []).reduce((s: number, q: any) => s + Number(q.total_amount || q.total || 0), 0);
      const totalMonth = monthQuotes?.length || 0;
      const approvedMonth = approved?.length || 0;
      setKpis({
        overdueFollowups: overdueTasks?.length || 0,
        inactiveClients: inactive?.length || 0,
        negotiating: negotiating?.length || 0,
        forecastRevenue: forecast,
        approvedMonth,
        conversion: totalMonth ? Math.round((approvedMonth / totalMonth) * 1000) / 10 : 0,
      });
    })();
  }, []);

  const loadHistory = async () => {
    const { data } = await supabase
      .from('assistant_conversations')
      .select('*')
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory((data as any) || []);
  };

  const ask = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setLoading(true);
    setResponse(null);
    try {
      const { data, error } = await supabase.functions.invoke('assistant-commercial', {
        body: { question: text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResponse(data as AssistantResponse);
      setQuestion(text);
    } catch (e: any) {
      toast.error('Não foi possível consultar o assistente', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (row: ConversationRow) => {
    await supabase.from('assistant_conversations').update({ is_favorite: !row.is_favorite }).eq('id', row.id);
    loadHistory();
  };
  const remove = async (id: string) => {
    await supabase.from('assistant_conversations').delete().eq('id', id);
    loadHistory();
  };

  const kpiCards = [
    { key: 'overdueFollowups', label: 'Follow-ups atrasados', value: kpis.overdueFollowups, icon: Clock, tone: 'danger' as const, action: () => ask('Follow-ups atrasados') },
    { key: 'inactiveClients', label: 'Clientes há +180 dias sem comprar', value: kpis.inactiveClients, icon: Users, tone: 'warning' as const, action: () => ask('Clientes há mais de 180 dias sem comprar') },
    { key: 'negotiating', label: 'Propostas em negociação', value: kpis.negotiating, icon: FileText, tone: 'info' as const, action: () => ask('Propostas em negociação') },
    { key: 'forecastRevenue', label: 'Receita prevista', value: kpis.forecastRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }), icon: TrendingUp, tone: 'success' as const, action: () => ask('Métricas do mês') },
    { key: 'approvedMonth', label: 'Aprovados no mês', value: kpis.approvedMonth, icon: Target, tone: 'success' as const, action: () => ask('Orçamentos aprovados este mês') },
    { key: 'conversion', label: 'Conversão do mês', value: `${kpis.conversion}%`, icon: Compass, tone: 'info' as const, action: () => ask('Qual a conversão do mês e ranking dos vendedores?') },
  ];

  const toneClass = {
    danger: 'text-rose-600 bg-rose-50 border-rose-100',
    warning: 'text-amber-600 bg-amber-50 border-amber-100',
    info: 'text-sky-600 bg-sky-50 border-sky-100',
    success: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  };

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 py-6 md:py-10 space-y-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-[0.14em]">
            <Compass className="h-3.5 w-3.5" />
            Assistente Comercial
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{greeting}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão consolidada do seu dia. Consulte dados reais do CRM e receba respostas executivas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setShowHistory(true); loadHistory(); }}>
          <History className="h-4 w-4" /> Histórico
        </Button>
      </header>

      {/* KPI Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {kpiCards.map(({ key, label, value, icon: Icon, tone, action }) => (
          <button
            key={key}
            onClick={action}
            className="text-left group"
          >
            <Card className="p-4 md:p-5 border-border/60 hover:border-foreground/25 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
                </div>
                <div className={`h-9 w-9 rounded-md border flex items-center justify-center ${toneClass[tone]}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </Card>
          </button>
        ))}
      </section>

      {/* Search */}
      <section>
        <Card className="p-4 md:p-6 border-border/70">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Consultar</label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && ask()}
              placeholder="Pergunte qualquer coisa sobre suas vendas..."
              className="h-11 text-base"
              disabled={loading}
            />
            <Button onClick={() => ask()} disabled={loading || !question.trim()} className="h-11 px-5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? 'Analisando' : 'Perguntar'}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </Card>
      </section>

      {/* Response */}
      {response && (
        <section className="space-y-4">
          <Card className="p-5 md:p-6 border-border/70">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Resposta</p>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">{response.answer}</p>
            {response.tool_used && (
              <p className="mt-3 text-[11px] text-muted-foreground">Fonte: {response.tool_used}</p>
            )}
          </Card>

          {response.result?.summary && (
            <Card className="p-5 border-border/70">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Resumo</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(response.result.summary).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[11px] uppercase text-muted-foreground">{k.replace(/_/g, ' ')}</p>
                    <p className="text-lg font-semibold text-foreground">{formatValue(v, k)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {response.result?.rows && response.result.rows.length > 0 && (
            <Card className="border-border/70 overflow-hidden">
              <div className="p-4 border-b border-border/60 flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {response.result.count} {response.result.entity === 'clients' ? 'clientes' : response.result.entity === 'quotes' ? 'orçamentos' : 'registros'} encontrados
                </p>
              </div>
              <div className="overflow-x-auto max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {response.result.columns?.map((c) => (
                        <TableHead key={c}>{columnLabel(c)}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {response.result.rows.map((row, i) => (
                      <TableRow key={row.id || i}>
                        {response.result?.columns?.map((c) => (
                          <TableCell key={c} className="text-sm">{formatValue(row[c], c)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {response.result?.rows && response.result.rows.length === 0 && (
            <Card className="p-5 border-border/70 text-sm text-muted-foreground">
              Nenhum registro encontrado para esta consulta.
            </Card>
          )}
        </section>
      )}

      {/* History */}
      <Sheet open={showHistory} onOpenChange={setShowHistory}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Histórico</SheetTitle>
            <SheetDescription>Suas consultas anteriores neste assistente.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem consultas ainda.</p>
            )}
            {history.map((h) => (
              <div key={h.id} className="group border border-border/60 rounded-md p-3 hover:border-foreground/25 transition-colors">
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => { setQuestion(h.question); setShowHistory(false); ask(h.question); }}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-foreground line-clamp-2">{h.question}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      {h.tool_used ? ` · ${h.tool_used}` : ''}
                    </p>
                  </button>
                  <button onClick={() => toggleFavorite(h)} className="p-1 text-muted-foreground hover:text-amber-500">
                    <Star className={`h-4 w-4 ${h.is_favorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                  <button onClick={() => remove(h.id)} className="p-1 text-muted-foreground hover:text-rose-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
