import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Wrench, 
  Search, 
  Plus, 
  Settings,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Maintenance {
  id: string;
  description: string;
  brand: string;
  model: string;
  status: string;
  created_at: string;
  technician: string;
}

export default function SupportMaintenance() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMaintenances = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('technical_maintenances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMaintenances(data || []);
    } catch (error) {
      console.error('Error fetching maintenances:', error);
      toast.error('Erro ao carregar manutenções');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenances();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'concluido':
      case 'completed':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Concluída</Badge>;
      case 'pendente':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Manutenção Preventiva</h1>
          <p className="text-sm text-muted-foreground">Gestão de infraestrutura e equipamentos internos</p>
        </div>
        <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white">
          <Plus className="h-4 w-4" />
          Novo Agendamento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Tudo em ordem</span>
            </div>
            <h3 className="text-2xl font-bold">12</h3>
            <p className="text-xs text-muted-foreground mt-1">Sistemas ativos</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-rose-500 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider font-bold">Atenção</span>
            </div>
            <h3 className="text-2xl font-bold text-rose-600">02</h3>
            <p className="text-xs text-muted-foreground mt-1">Atrasadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Data</th>
                <th className="px-6 py-4 font-semibold">Equipamento</th>
                <th className="px-6 py-4 font-semibold">Descrição</th>
                <th className="px-6 py-4 font-semibold">Técnico</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse h-16 bg-muted/20" />
                ))
              ) : maintenances.length > 0 ? (
                maintenances.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {new Date(m.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      {m.brand} {m.model}
                    </td>
                    <td className="px-6 py-4">
                      {m.description}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="font-normal capitalize">{m.technician || 'Não atribuído'}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(m.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <p className="text-muted-foreground">Nenhuma manutenção agendada.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
