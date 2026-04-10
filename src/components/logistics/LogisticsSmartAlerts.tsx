import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock, FileText, Truck } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface LogisticsRecord {
  id: string;
  logistics_status: string;
  nf_numero: string | null;
  codigo_rastreio: string | null;
  data_envio: string | null;
  created_at: string;
  updated_at: string;
  quote_number?: string;
  client_name?: string;
}

interface SmartAlertsProps {
  records: LogisticsRecord[];
}

export default function LogisticsSmartAlerts({ records }: SmartAlertsProps) {
  const now = new Date();

  const staleOrders = records.filter(r => {
    if (['entregue', 'problema_logistico'].includes(r.logistics_status)) return false;
    const days = differenceInDays(now, new Date(r.updated_at));
    return days >= 3;
  });

  const nfNotSent = records.filter(r =>
    r.logistics_status === 'nf_emitida' && r.nf_numero &&
    differenceInDays(now, new Date(r.updated_at)) >= 2
  );

  const sentNoTracking = records.filter(r =>
    ['enviado', 'em_transporte'].includes(r.logistics_status) && !r.codigo_rastreio
  );

  const alerts = [
    ...(staleOrders.length > 0 ? [{
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      message: `${staleOrders.length} pedido(s) parado(s) há 3+ dias sem atualização`,
    }] : []),
    ...(nfNotSent.length > 0 ? [{
      icon: FileText,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      message: `${nfNotSent.length} pedido(s) com NF emitida mas ainda não enviado(s)`,
    }] : []),
    ...(sentNoTracking.length > 0 ? [{
      icon: Truck,
      color: 'text-orange-600 bg-orange-50 border-orange-200',
      message: `${sentNoTracking.length} pedido(s) enviado(s) sem código de rastreio`,
    }] : []),
  ];

  if (alerts.length === 0) return null;

  return (
    <Card className="border-yellow-200 bg-yellow-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          Alertas Inteligentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert, i) => {
          const Icon = alert.icon;
          return (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${alert.color}`}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">{alert.message}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
