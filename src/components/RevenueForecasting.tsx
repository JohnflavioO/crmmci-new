import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, Send, Handshake } from 'lucide-react';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface Props {
  quotes: any[];
}

export default function RevenueForecasting({ quotes }: Props) {
  const sent = quotes.filter(q => q.status === 'sent');
  const negotiation = quotes.filter(q => q.status === 'draft');
  const approved = quotes.filter(q => q.status === 'approved');
  
  const sentValue = sent.reduce((s, q) => s + (parseFloat(q.total_amount) || 0), 0);
  const negotiationValue = negotiation.reduce((s, q) => s + (parseFloat(q.total_amount) || 0), 0);
  const approvedValue = approved.reduce((s, q) => s + (parseFloat(q.total_amount) || 0), 0);
  const forecastValue = sentValue + negotiationValue;

  const items = [
    { label: 'Em Negociação', value: negotiationValue, icon: Handshake, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Propostas Enviadas', value: sentValue, icon: Send, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Valor Aprovado', value: approvedValue, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Previsão Faturamento', value: forecastValue, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(item => (
        <Card key={item.label} className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-sm md:text-base font-bold ${item.color}`}>{formatCurrency(item.value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
