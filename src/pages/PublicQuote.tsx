import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster as Sonner } from "@/components/ui/sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function PublicQuote() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  // Create a client that sends the token in custom header for RLS verification
  const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      headers: {
        'x-quote-token': token || '',
      },
    },
  });

  useEffect(() => {
    const load = async () => {
      if (!token) { setError('Token inválido'); setLoading(false); return; }
      const { data: q, error: qErr } = await anonClient.from('quotes').select('*').eq('public_token', token).single();
      if (qErr || !q) { setError('Orçamento não encontrado'); setLoading(false); return; }
      setQuote(q);
      const { data: it } = await anonClient.from('quote_items').select('*').eq('quote_id', q.id).order('item_number');
      setItems(it || []);
      setLoading(false);
    };
    load();
  }, [token]);

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!quote) return;
    setActing(true);
    const updates: any = { 
      status: action,
      ...(action === 'approved' ? { approved_at: new Date().toISOString() } : { rejected_at: new Date().toISOString() }),
    };
    const { error } = await anonClient.from('quotes').update(updates).eq('public_token', token);
    if (error) { toast.error('Erro ao processar. Tente novamente.'); setActing(false); return; }
    setQuote((prev: any) => ({ ...prev, ...updates }));
    toast.success(action === 'approved' ? 'Orçamento aprovado com sucesso!' : 'Orçamento rejeitado.');
    setActing(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full"><CardContent className="p-8 text-center">
        <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Oops!</h2>
        <p className="text-muted-foreground">{error}</p>
      </CardContent></Card>
    </div>
  );

  const alreadyActed = quote.status === 'approved' || quote.status === 'rejected';
  const subtotal = items.reduce((s, i) => s + (parseFloat(i.line_total) || 0), 0);
  const shipping = parseFloat(quote.shipping_cost) || 0;
  const total = parseFloat(quote.total_amount) || 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <Sonner />
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <img src="/mci-logo.png" alt="MCI Store" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-display">Orçamento {quote.quote_number}</h1>
          <p className="text-muted-foreground">
            Data: {quote.quote_date ? new Date(quote.quote_date).toLocaleDateString('pt-BR') : '-'}
          </p>
          {alreadyActed && (
            <Badge className={`mt-3 text-sm ${quote.status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-destructive text-white'}`}>
              {quote.status === 'approved' ? '✅ Aprovado' : '❌ Rejeitado'}
              {quote.approved_at && ` em ${new Date(quote.approved_at).toLocaleDateString('pt-BR')}`}
              {quote.rejected_at && ` em ${new Date(quote.rejected_at).toLocaleDateString('pt-BR')}`}
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Informações</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Cliente:</span> <strong>{quote.client_name}</strong></div>
              <div><span className="text-muted-foreground">Vendedor:</span> <strong>{quote.salesperson || '-'}</strong></div>
              {quote.payment_terms && <div><span className="text-muted-foreground">Cond. Pagamento:</span> {quote.payment_terms}</div>}
              {quote.proposal_validity && <div><span className="text-muted-foreground">Validade:</span> {quote.proposal_validity}</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Itens do Orçamento</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={item.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 object-contain rounded" />}
                        <div>
                          <p className="font-medium text-sm">{item.model || item.description}</p>
                          {item.specifications && <p className="text-xs text-muted-foreground">{item.specifications}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.brand || '-'}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(parseFloat(item.unit_price) || 0)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(parseFloat(item.line_total) || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 space-y-1 text-right text-sm">
              <p>Subtotal: <strong>{formatCurrency(subtotal)}</strong></p>
              {shipping > 0 && <p>Frete: <strong>{formatCurrency(shipping)}</strong></p>}
              <p className="text-lg font-bold text-primary">Total: {formatCurrency(total)}</p>
            </div>
          </CardContent>
        </Card>

        {quote.notes && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Observações</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{quote.notes}</p></CardContent>
          </Card>
        )}

        {!alreadyActed && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-h-[48px] text-base"
              onClick={() => handleAction('approved')}
              disabled={acting}
            >
              {acting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
              Aprovar Orçamento
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="gap-2 min-h-[48px] text-base"
              onClick={() => handleAction('rejected')}
              disabled={acting}
            >
              {acting ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
              Rejeitar Orçamento
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-8">
          MCI Store — Sistema de Orçamentos
        </p>
      </div>
    </div>
  );
}
