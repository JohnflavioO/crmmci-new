import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, Send, Handshake, CalendarDays } from 'lucide-react';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
  quotes: any[];
}

export default function RevenueForecasting({ quotes }: Props) {
  const cycle = getBillingCycle();

  // Filter quotes within the billing cycle
  const cycleQuotes = quotes.filter(q => {
    const d = new Date(q.created_at || q.quote_date);
    return d >= cycle.start && d <= cycle.end;
  });

  const sent = cycleQuotes.filter(q => q.status === 'sent');
  const negotiation = cycleQuotes.filter(q => q.status === 'negociacao');
  const approved = cycleQuotes.filter(q => q.status === 'approved');
  const preVenda = cycleQuotes.filter(q => q.status === 'pre_venda' || q.status === 'contato_feito');

  const sentValue = sent.reduce((s, q) => s + (parseFloat(q.total_amount) || 0), 0);
  const negotiationValue = negotiation.reduce((s, q) => s + (parseFloat(q.total_amount) || 0), 0);
  const approvedValue = approved.reduce((s, q) => s + (parseFloat(q.total_amount) || 0), 0);
  const preVendaValue = preVenda.reduce((s, q) => s + (parseFloat(q.total_amount) || 0), 0);
  const forecastValue = sentValue + negotiationValue + preVendaValue;

  const items = [
    { label: 'Em Negociação', value: negotiationValue, count: negotiation.length, icon: Handshake, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Propostas Enviadas', value: sentValue, count: sent.length, icon: Send, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Faturado no Ciclo', value: approvedValue, count: approved.length, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Previsão Faturamento', value: forecastValue, count: sent.length + negotiation.length + preVenda.length, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
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
