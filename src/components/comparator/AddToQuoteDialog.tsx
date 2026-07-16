import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { ComparatorProduct } from '@/hooks/useEquivalentSearch';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: ComparatorProduct | null;
}

const db = supabase as any;

export default function AddToQuoteDialog({ open, onOpenChange, product }: Props) {
  const [quoteId, setQuoteId] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['open_quotes_for_equivalent'],
    queryFn: async () => {
      const { data, error } = await db
        .from('quotes')
        .select('id, quote_number, client_name, status')
        .in('status', ['draft', 'sent', 'pre_sale', 'contact_made', 'negotiation', 'negociacao'])
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
    staleTime: 30_000,
  });

  const handleAdd = async () => {
    if (!product || !quoteId) {
      toast.error('Escolha um orçamento');
      return;
    }
    setSaving(true);
    try {
      const { error } = await db.from('quote_items').insert({
        quote_id: quoteId,
        description: product.name,
        brand: product.brand ?? null,
        code: product.code ?? null,
        product_code: product.code ?? product.sku ?? null,
        category: product.category_principal ?? null,
        image_url: product.image_url ?? null,
        quantity: qty,
        unit_price: product.price ?? 0,
        total_price: (product.price ?? 0) * qty,
        line_total: (product.price ?? 0) * qty,
      });
      if (error) throw error;
      toast.success('Produto adicionado ao orçamento');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Falha ao adicionar: ' + (e?.message ?? 'erro'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar ao orçamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {product && (
            <div className="flex gap-3 items-center border rounded-md p-3 bg-muted/30">
              {product.image_url && <img src={product.image_url} alt="" className="w-12 h-12 object-contain rounded" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.brand ?? ''}</p>
              </div>
            </div>
          )}
          <div>
            <Label>Orçamento</Label>
            <Select value={quoteId} onValueChange={setQuoteId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione um orçamento em aberto'} />
              </SelectTrigger>
              <SelectContent>
                {(quotes ?? []).map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.quote_number} — {q.client_name ?? 'Cliente'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={saving || !quoteId}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
