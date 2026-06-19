import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Filter,
  Package,
  Calendar,
  Truck,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface PurchaseOrder {
  id: string;
  status: string;
  total_amount: number;
  expected_delivery: string;
  created_at: string;
  technical_suppliers: {
    name: string;
  } | null;
}

import { NewPurchaseOrderDialog } from '@/components/support/NewPurchaseOrderDialog';

export default function SupportPurchases() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('technical_purchase_orders')
        .select('*, technical_suppliers(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      toast.error('Erro ao carregar ordens de compra');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aprovada':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Aprovada</Badge>;
      case 'recebida':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"><Truck className="h-3 w-3" /> Recebida</Badge>;
      case 'cancelada':
        return <Badge className="bg-rose-500 hover:bg-rose-600 text-white gap-1"><XCircle className="h-3 w-3" /> Cancelada</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
    }
  };

  const filteredOrders = orders.filter(o => 
    o.technical_suppliers?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Ordens de Compra</h1>
          <p className="text-sm text-muted-foreground">Gestão de aquisição de peças e insumos</p>
        </div>
        <Button 
          size="sm" 
          className="gap-2 bg-primary hover:bg-primary/90 text-white"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Nova Venda
        </Button>
      </div>

      <NewPurchaseOrderDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onSuccess={fetchOrders}
      />

      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por fornecedor..." 
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

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Data</th>
                <th className="px-6 py-4 font-semibold">Fornecedor</th>
                <th className="px-6 py-4 font-semibold">Previsão</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-6 h-16 bg-muted/20" />
                  </tr>
                ))
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {order.technical_suppliers?.name || 'Fornecedor não informado'}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        {order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString('pt-BR') : '--/--/----'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">
                      R$ {Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-muted-foreground">Nenhuma ordem de compra encontrada.</p>
                    </div>
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
