import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { generateQuotePdf } from '@/lib/generateQuotePdf';
import AppLayout from '@/components/AppLayout';
import QuoteHeader from '@/components/QuoteHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, FileText, X, Download, MessageCircle, CreditCard, QrCode, FileBarChart, CheckCircle2, Clock, CircleDot } from 'lucide-react';

const db = supabase as any;

const statusLabels: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviado', approved: 'Aprovado', rejected: 'Rejeitado',
};

const paymentMethodLabels: Record<string, { label: string; icon: any }> = {
  pix: { label: 'PIX', icon: QrCode },
  cartao: { label: 'Cartão', icon: CreditCard },
  boleto: { label: 'Boleto', icon: FileBarChart },
};

const paymentStatusLabels: Record<string, { label: string; icon: any; className: string }> = {
  pendente: { label: 'Pendente', icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  em_andamento: { label: 'Em andamento', icon: CircleDot, className: 'bg-blue-100 text-blue-800 border-blue-200' },
  liquidado: { label: 'Liquidado', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

interface QuoteItem {
  id?: string;
  item_number: number;
  product_code: string;
  quantity: number;
  model: string;
  brand: string;
  specifications: string;
  unit_price: number;
  discount_percent: number;
  unit_total: number;
  line_total: number;
  image_url: string;
}

const emptyItem = (): QuoteItem => ({
  item_number: 1, product_code: '', quantity: 1, model: '', brand: '',
  specifications: '', unit_price: 0, discount_percent: 0, unit_total: 0, line_total: 0, image_url: '',
});

const shippingMethods = [
  { value: 'correios', label: 'Correios' },
  { value: 'mao_propria', label: 'Mão Própria' },
  { value: 'retirada', label: 'Retirada' },
  { value: 'transportadora', label: 'Transportadora' },
];

export default function Quotes() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any | null>(null);
  const [form, setForm] = useState({
    client_id: '', salesperson: '', status: 'draft', notes: '',
    payment_terms: '', shipping_deadline: '', shipping_method: '',
    shipping_cost: 0, proposal_validity: '15 dias',
  });
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
  const [showProductDropdown, setShowProductDropdown] = useState<number | null>(null);

  const loadData = async () => {
    try {
      const [q, c, s, p] = await Promise.all([
        db.from('quotes').select('*, clients(company_name, phone)')
          .order('created_at', { ascending: false }),
        db.from('clients').select('id, company_name').order('company_name'),
        db.from('salespeople').select('*').eq('active', true).order('name'),
        db.from('products').select('id, name, brand, code, price, description, image_url').order('name'),
      ]);
      setQuotes(q.data || []);
      setClients(c.data || []);
      setSalespeople(s.data || []);
      setProducts(p.data || []);
    } catch (err) {
      console.error('loadData error:', err);
    }
  };

  useEffect(() => { loadData(); }, []);

  const calcItem = (item: QuoteItem): QuoteItem => {
    const unitTotal = item.unit_price * (1 - item.discount_percent / 100);
    const lineTotal = unitTotal * item.quantity;
    return { ...item, unit_total: Math.round(unitTotal * 100) / 100, line_total: Math.round(lineTotal * 100) / 100 };
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = calcItem({ ...updated[index], [field]: value });
      return updated;
    });
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const selectProduct = (idx: number, product: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = calcItem({
        ...updated[idx],
        model: product.name,
        brand: product.brand || '',
        product_code: product.code || '',
        specifications: product.description || '',
        unit_price: parseFloat(product.price) || 0,
        image_url: product.image_url || '',
      });
      return updated;
    });
    setProductSearch(prev => ({ ...prev, [idx]: '' }));
    setShowProductDropdown(null);
  };

  const getFilteredProducts = (idx: number) => {
    const q = (productSearch[idx] || '').toLowerCase();
    if (!q) return [];
    return products.filter((p: any) =>
      p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
    ).slice(0, 8);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);
  const grandTotal = totalAmount + (form.shipping_cost || 0);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleSave = async () => {
    if (!form.client_id) { toast.error('Selecione um cliente'); return; }
    if (items.every(i => !i.model)) { toast.error('Adicione pelo menos um item'); return; }

    try {
      let quoteId: string;
      const quoteData = {
        client_id: form.client_id, salesperson: form.salesperson, status: form.status,
        notes: form.notes, total_amount: grandTotal,
        payment_terms: form.payment_terms, shipping_deadline: form.shipping_deadline,
        shipping_method: form.shipping_method, shipping_cost: form.shipping_cost,
        proposal_validity: form.proposal_validity,
      };

      if (editingQuote) {
        const { error } = await db.from('quotes').update(quoteData).eq('id', editingQuote.id);
        if (error) throw error;
        quoteId = editingQuote.id;
        await db.from('quote_items').delete().eq('quote_id', quoteId);
      } else {
        const { data: numData } = await db.rpc('generate_quote_number');
        const { data, error } = await db.from('quotes').insert({
          ...quoteData,
          quote_number: numData || `ORC-${Date.now()}`,
          created_by: user?.id,
        }).select('id').single();
        if (error) throw error;
        quoteId = data.id;
      }

      const validItems = items.filter(i => i.model).map((item, idx) => ({
        quote_id: quoteId, item_number: idx + 1, product_code: item.product_code,
        quantity: item.quantity, model: item.model, brand: item.brand,
        specifications: item.specifications, unit_price: item.unit_price,
        discount_percent: item.discount_percent, unit_total: item.unit_total,
        line_total: item.line_total, image_url: item.image_url,
      }));

      if (validItems.length > 0) {
        const { error } = await db.from('quote_items').insert(validItems);
        if (error) throw error;
      }

      toast.success(editingQuote ? 'Orçamento atualizado!' : 'Orçamento criado!');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEdit = async (quote: any) => {
    const { data: qItems } = await db.from('quote_items').select('*').eq('quote_id', quote.id).order('item_number');
    setEditingQuote(quote);
    setForm({
      client_id: quote.client_id || '', salesperson: quote.salesperson || '',
      status: quote.status, notes: quote.notes || '',
      payment_terms: quote.payment_terms || '', shipping_deadline: quote.shipping_deadline || '',
      shipping_method: quote.shipping_method || '',
      shipping_cost: parseFloat(quote.shipping_cost) || 0,
      proposal_validity: quote.proposal_validity || '15 dias',
    });
    setItems(qItems?.length > 0 ? qItems : [emptyItem()]);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este orçamento?')) return;
    const { error } = await db.rpc('delete_quote_cascade', { p_quote_id: id });
    if (error) toast.error(error.message);
    else { toast.success('Orçamento excluído'); loadData(); }
  };

  const handleExportPdf = async (quote: any) => {
    try {
      const [{ data: qItems }, { data: clientData }] = await Promise.all([
        db.from('quote_items').select('*').eq('quote_id', quote.id).order('item_number'),
        db.from('clients').select('*').eq('id', quote.client_id).maybeSingle(),
      ]);
      await generateQuotePdf(quote, qItems || [], clientData);
      toast.success('PDF gerado!');
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + err.message);
    }
  };

  const resetForm = () => {
    setEditingQuote(null);
    setForm({ client_id: '', salesperson: '', status: 'draft', notes: '', payment_terms: '', shipping_deadline: '', shipping_method: '', shipping_cost: 0, proposal_validity: '15 dias' });
    setItems([emptyItem()]);
  };

  const filtered = quotes.filter((q: any) =>
    q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
    q.clients?.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display">Orçamentos</h1>
          <p className="text-muted-foreground">Crie e gerencie seus orçamentos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Orçamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingQuote ? `Editar ${editingQuote.quote_number}` : 'Novo Orçamento'}
              </DialogTitle>
            </DialogHeader>

            {/* MCI Header */}
            <QuoteHeader />

            <div className="space-y-6 mt-4">
              {/* Client, Salesperson, Status */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vendedor</Label>
                  <Select value={form.salesperson} onValueChange={v => setForm(p => ({ ...p, salesperson: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
                    <SelectContent>
                      {salespeople.map((s: any) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="sent">Enviado</SelectItem>
                      <SelectItem value="approved">Aprovado</SelectItem>
                      <SelectItem value="rejected">Rejeitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Validade da Proposta</Label>
                  <Input value={form.proposal_validity} onChange={e => setForm(p => ({ ...p, proposal_validity: e.target.value }))} placeholder="Ex: 15 dias" />
                </div>
              </div>

              {/* Payment & Shipping */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg border bg-muted/20">
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Input
                    value={form.payment_terms}
                    onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))}
                    placeholder="Ex: 30/60/90 dias, à vista, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prazo de Envio</Label>
                  <Input
                    value={form.shipping_deadline}
                    onChange={e => setForm(p => ({ ...p, shipping_deadline: e.target.value }))}
                    placeholder="Ex: 5 dias úteis"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Forma de Envio</Label>
                  <Select value={form.shipping_method} onValueChange={v => setForm(p => ({ ...p, shipping_method: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {shippingMethods.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor do Frete (R$)</Label>
                  <Input type="number" step="0.01" min={0}
                    value={form.shipping_cost}
                    onChange={e => setForm(p => ({ ...p, shipping_cost: parseFloat(e.target.value) || 0 }))}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={4} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Observações gerais do orçamento..." />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Itens do Orçamento</Label>
                  <Button type="button" size="sm" onClick={addItem} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="h-3 w-3" /> Adicionar Item
                  </Button>
                </div>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.model} className="w-12 h-12 object-contain rounded border" onError={e => (e.currentTarget.style.display = 'none')} />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
                              <FileText className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                          <span className="text-sm font-medium">Item {idx + 1}{item.model ? ` — ${item.model}` : ''}</span>
                        </div>
                        {items.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {/* Product Search */}
                      <div className="space-y-1 relative col-span-full">
                        <Label className="text-xs">Buscar Produto (digite para pesquisar)</Label>
                        <Input
                          placeholder="Digite nome, marca ou código do produto..."
                          value={productSearch[idx] || ''}
                          onChange={e => {
                            setProductSearch(prev => ({ ...prev, [idx]: e.target.value }));
                            setShowProductDropdown(idx);
                          }}
                          onFocus={() => setShowProductDropdown(idx)}
                          onBlur={() => setTimeout(() => setShowProductDropdown(null), 200)}
                        />
                        {showProductDropdown === idx && getFilteredProducts(idx).length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {getFilteredProducts(idx).map((p: any) => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between"
                                onMouseDown={() => selectProduct(idx, p)}
                              >
                                <span className="font-medium">{p.name}</span>
                                <span className="text-muted-foreground text-xs">{p.brand} • {formatCurrency(parseFloat(p.price) || 0)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Modelo *</Label>
                          <Input value={item.model} onChange={e => updateItem(idx, 'model', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Marca</Label>
                          <Input value={item.brand} onChange={e => updateItem(idx, 'brand', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Código</Label>
                          <Input value={item.product_code} onChange={e => updateItem(idx, 'product_code', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Qtd</Label>
                          <Input type="number" min={1} value={item.quantity}
                            onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Especificações</Label>
                        <Textarea value={item.specifications} rows={2}
                          onChange={e => updateItem(idx, 'specifications', e.target.value)} />
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Preço Unit. (R$)</Label>
                          <Input type="number" step="0.01" value={item.unit_price}
                            onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Desconto (%)</Label>
                          <Input type="number" step="0.1" min={0} max={100} value={item.discount_percent}
                            onChange={e => updateItem(idx, 'discount_percent', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Valor Unit.</Label>
                          <Input value={formatCurrency(item.unit_total)} readOnly className="bg-muted" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Total</Label>
                          <Input value={formatCurrency(item.line_total)} readOnly className="bg-muted font-semibold" />
                        </div>
                      </div>
                    </div>
                    ))}
                  </div>
                  <Button type="button" onClick={addItem} className="mt-3 w-full gap-2 bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="h-4 w-4" /> Adicionar Novo Item
                  </Button>

                <div className="flex justify-end mt-4 p-3 bg-primary/5 rounded-lg">
                  <div className="text-right space-y-1">
                    <p className="text-sm text-muted-foreground">Subtotal: {formatCurrency(totalAmount)}</p>
                    {form.shipping_cost > 0 && <p className="text-sm text-muted-foreground">Frete: {formatCurrency(form.shipping_cost)}</p>}
                    <p className="text-2xl font-bold font-display text-primary">Total: {formatCurrency(grandTotal)}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave}>Salvar Orçamento</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar orçamento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3">Nenhum orçamento encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Orçamento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                   <TableHead>Data</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Frete</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.quote_number}</TableCell>
                    <TableCell>{q.clients?.company_name || '-'}</TableCell>
                    <TableCell>{q.salesperson || '-'}</TableCell>
                    <TableCell>{new Date(q.quote_date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(q.total_amount) || 0)}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(q.shipping_cost) || 0)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency((parseFloat(q.total_amount) || 0) + (parseFloat(q.shipping_cost) || 0))}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[q.status] || 'secondary'}>
                        {statusLabels[q.status] || q.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {q.clients?.phone && (
                          <Button size="icon" variant="ghost" asChild title="WhatsApp">
                            <a
                              href={`https://wa.me/${q.clients.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="h-4 w-4 text-green-600" />
                            </a>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => handleExportPdf(q)} title="Exportar PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(q)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(q.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
