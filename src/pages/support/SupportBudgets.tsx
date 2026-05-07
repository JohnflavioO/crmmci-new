import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, 
  Search, 
  Plus, 
  Filter,
  User,
  BadgeAlert,
  BadgeCheck,
  BadgeX,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Budget {
  id: string;
  status: string;
  total_amount: number;
  valid_until: string;
  created_at: string;
  technical_clients: {
    name: string;
  } | null;
  technical_orders: {
    os_number: string;
  } | null;
}

export default function SupportBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('technical_budgets')
        .select('*, technical_clients(name), technical_orders(os_number)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBudgets(data || []);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      toast.error('Erro ao carregar orçamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'enviado':
        return <Badge variant="outline" className="border-blue-500 text-blue-600 gap-1"><Clock className="h-3 w-3" /> Enviado</Badge>;
      case 'aprovado':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"><BadgeCheck className="h-3 w-3" /> Aprovado</Badge>;
      case 'recusado':
        return <Badge className="bg-rose-500 hover:bg-rose-600 text-white gap-1"><BadgeX className="h-3 w-3" /> Recusado</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><BadgeAlert className="h-3 w-3" /> Rascunho</Badge>;
    }
  };

  const filteredBudgets = budgets.filter(b => 
    b.technical_clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.technical_orders?.os_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Orçamentos Técnicos</h1>
          <p className="text-sm text-muted-foreground">Emissão e acompanhamento de propostas</p>
        </div>
        <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white">
          <Plus className="h-4 w-4" />
          Novo Orçamento
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por cliente ou OS..." 
            className="pl-9 bg-background border-border"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2 h-10 px-4">
          <Filter className="h-4 w-4" />
          Filtrar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse border-border shadow-sm">
              <CardContent className="h-40" />
            </Card>
          ))
        ) : filteredBudgets.length > 0 ? (
          filteredBudgets.map((budget) => (
            <Card key={budget.id} className="hover:border-primary/50 transition-all border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Badge variant="secondary" className="text-[10px] font-bold">
                  OS: {budget.technical_orders?.os_number || 'N/A'}
                </Badge>
                {getStatusBadge(budget.status)}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-full">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{budget.technical_clients?.name}</p>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="text-xs text-muted-foreground">
                    Expira em: {budget.valid_until ? new Date(budget.valid_until).toLocaleDateString('pt-BR') : '--'}
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    R$ {Number(budget.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                
                <Button variant="ghost" className="w-full text-primary hover:text-primary hover:bg-primary/5 text-xs font-bold gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  Visualizar PDF
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold">Nenhum orçamento encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
