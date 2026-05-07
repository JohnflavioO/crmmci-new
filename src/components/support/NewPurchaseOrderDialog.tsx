import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price?: number;
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface NewPurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewPurchaseOrderDialog({ open, onOpenChange, onSuccess }: NewPurchaseOrderDialogProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [orderType, setOrderType] = useState('Compra');
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('pendente');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      fetchProducts();
      // Reset form
      setOrderType('Compra');
      setSupplierId('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setStatus('pendente');
      setNotes('');
      setItems([]);
    }
  }, [open]);

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('technical_suppliers')
      .select('id, name')
      .order('name');
    if (error) {
      console.error('Error fetching suppliers:', error);
      return;
    }
    setSuppliers(data || []);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('technical_products')
      .select('id, name, price')
      .order('name');
    if (error) {
      console.error('Error fetching products:', error);
      return;
    }
    setProducts(data || []);
  };

  const addItem = () => {
    const newItem: OrderItem = {
      id: Math.random().toString(36).substring(7),
      product_id: '',
      product_name: '',
      quantity: 1,
      unit_price: 0,
      subtotal: 0
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // If product changed, update price and name
        if (field === 'product_id') {
          const product = products.find(p => p.id === value);
          if (product) {
            updatedItem.product_name = product.name;
            updatedItem.unit_price = product.price || 0;
          }
        }

        // Recalculate subtotal
        updatedItem.subtotal = updatedItem.quantity * updatedItem.unit_price;
        return updatedItem;
      }
      return item;
    }));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  const handleSubmit = async () => {
    if (!supplierId) {
      toast.error('Selecione um fornecedor');
      return;
    }

    if (items.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    // Check if all items have a product selected
    if (items.some(item => !item.product_id)) {
      toast.error('Selecione um produto para todos os itens');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Create Purchase Order
      const { data: order, error: orderError } = await supabase
        .from('technical_purchase_orders')
        .insert({
          supplier_id: supplierId,
          order_type: orderType,
          purchase_date: purchaseDate,
          status,
          notes,
          total_amount: totalAmount
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create items
      const itemsToInsert = items.map(item => ({
        purchase_order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.subtotal
      }));

      const { error: itemsError } = await supabase
        .from('technical_purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success('Ordem de compra criada com sucesso!');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating purchase order:', error);
      toast.error('Erro ao criar ordem de compra: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-display">Nova Ordem de Compra</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Tipo de Ordem</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Compra">Compra</SelectItem>
                <SelectItem value="Garantia">Garantia</SelectItem>
                <SelectItem value="Devolução">Devolução</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data da Compra</Label>
            <Input 
              type="date" 
              value={purchaseDate} 
              onChange={(e) => setPurchaseDate(e.target.value)} 
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
                <SelectItem value="recebida">Recebida</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor Total</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input 
                type="number" 
                value={totalAmount.toFixed(2)} 
                readOnly 
                className="pl-9 bg-muted/50" 
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <Label>Observações</Label>
          <Textarea 
            placeholder="Informações adicionais..." 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-20"
          />
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Produtos / Itens</h3>
            <Button size="sm" variant="outline" onClick={addItem} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Item
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40%]">Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Valor Unitário</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum item adicionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Select 
                          value={item.product_id} 
                          onValueChange={(val) => updateItem(item.id, 'product_id', val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um produto..." />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          min="1" 
                          value={item.quantity} 
                          onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)} 
                        />
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                          <Input 
                            type="number" 
                            className="pl-8" 
                            value={item.unit_price} 
                            onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)} 
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        R$ {item.subtotal.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeItem(item.id)}
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="mt-8 flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-primary hover:bg-primary/90">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Ordem de Compra'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
