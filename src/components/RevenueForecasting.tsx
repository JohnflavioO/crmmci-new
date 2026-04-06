import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, Send, Handshake, CalendarDays } from 'lucide-react';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type QuoteForecast = {
  approved_at?: string | null;
  created_at?: string | null;
  payment_status?: string | null;
  quote_date?: string | null;
  status?: string | null;
  total_amount?: number | string | null;
  updated_at?: string | null;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toTimestamp = (value?: string | null) => {
  if (!value) return null;

  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const ts = new Date(year, month - 1, day, 12, 0, 0).getTime();
    return Number.isNaN(ts) ? null : ts;
  }

  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
};

const isClosedQuote = (quote: QuoteForecast) =>
  quote.status === 'approved' || quote.payment_status === 'liquidado';

const getQuoteCycleTimestamp = (quote: QuoteForecast) =>
  toTimestamp(quote.quote_date) ??
  toTimestamp(quote.created_at) ??
  toTimestamp(quote.approved_at) ??
  toTimestamp(quote.updated_at);

const getQuoteValue = (quote: QuoteForecast) => Number(quote.total_amount) || 0;

/** Returns the current billing cycle: day 20 of current/previous month to day 20 of next month */
function getBillingCycle(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based

  let start: Date, end: Date;
  if (now.getDate() >= 20) {
    start = new Date(year, month, 20, 0, 0, 0);
    end = new Date(year, month + 1, 20, 23, 59, 59);
  } else {
    start = new Date(year, month - 1, 20, 0, 0, 0);
    end = new Date(year, month, 20, 23, 59, 59);
  }

  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { start, end, label: `${fmt(start)} - ${fmt(end)}` };
}

interface Props {
  quotes: QuoteForecast[];
}

export default function RevenueForecasting({ quotes }: Props) {
  const cycle = getBillingCycle();
  const cycleStart = cycle.start.getTime();
  const cycleEnd = cycle.end.getTime();

  // Filter quotes within the billing cycle
  const cycleQuotes = quotes.filter(quote => {
    const ts = getQuoteCycleTimestamp(quote);
    return ts !== null && ts >= cycleStart && ts <= cycleEnd;
  });

  const sent = cycleQuotes.filter(q => q.status === 'sent');
  const negotiation = cycleQuotes.filter(q => q.status === 'negociacao');
  const closed = cycleQuotes.filter(isClosedQuote);
  const preVenda = cycleQuotes.filter(q => q.status === 'pre_venda' || q.status === 'contato_feito');

  const sentValue = sent.reduce((s, q) => s + getQuoteValue(q), 0);
  const negotiationValue = negotiation.reduce((s, q) => s + getQuoteValue(q), 0);
  const closedValue = closed.reduce((s, q) => s + getQuoteValue(q), 0);
  const preVendaValue = preVenda.reduce((s, q) => s + getQuoteValue(q), 0);

  // Previsão final: fechados + ponderação do pipeline (negociação 50%, enviadas 30%)
  const forecastValue = closedValue + (negotiationValue * 0.5) + (sentValue * 0.3);

  const items = [
    { label: 'Em Negociação', value: negotiationValue, count: negotiation.length, icon: Handshake, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Propostas Enviadas', value: sentValue, count: sent.length, icon: Send, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Fechados no Ciclo', value: closedValue, count: closed.length, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Previsão Final', value: forecastValue, count: closed.length + negotiation.length + sent.length, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <CalendarDays className="h-3.5 w-3.5" />
        <span>Ciclo: <strong>{cycle.label}</strong></span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(item => (
          <Card key={item.label} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <span className="text-xs text-muted-foreground ml-auto">{item.count} orç.</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`text-sm md:text-base font-bold ${item.color}`}>{formatCurrency(item.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
