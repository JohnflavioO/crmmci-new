import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Package, Link, Loader2, Image, ImageDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';

const db = supabase as any;

export default function Products() {
  const { isAdmin, isGestor } = useAuth();
  const isMobile = useIsMobile();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', sku: '', code: '', brand: '', description: '', price: 0, image_url: '' });
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [fetchingImages, setFetchingImages] = useState(false);
  const [imageProgress, setImageProgress] = useState({ current: 0, total: 0, found: 0 });

  const loadProducts = async () => {
    const { data } = await db.from('products')
      .select('*')
      .order('name')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setProducts(data || []);
  };

  useEffect(() => { loadProducts(); }, [page]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      const payload = { name: form.name, sku: form.sku, code: form.code, brand: form.brand, description: form.description, price: form.price, image_url: form.image_url };
      if (editing) {
        const { error } = await db.from('products').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Produto atualizado!');
      } else {
        const { error } = await db.from('products').insert(payload);
        if (error) throw error;
        toast.success('Produto cadastrado!');
      }
      setDialogOpen(false);
      resetForm();
      loadProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEdit = (product: any) => {
    setEditing(product);
    setForm({
      name: product.name || '', sku: product.sku || '', code: product.code || '',
      brand: product.brand || '', description: product.description || '',
      price: parseFloat(product.price) || 0, image_url: product.image_url || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este produto?')) return;
    const { error } = await db.from('products').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Produto excluído'); loadProducts(); }
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ name: '', sku: '', code: '', brand: '', description: '', price: 0, image_url: '' });
    setScrapeUrl('');
  };

  const handleFetchImages = async () => {
    const { data: allProducts } = await db.from('products')
      .select('id, name, code, sku, brand')
      .is('image_url', null)
      .order('name');

    if (!allProducts || allProducts.length === 0) {
      toast.info('Todos os produtos já possuem imagem!');
      return;
    }

    setFetchingImages(true);
    setImageProgress({ current: 0, total: allProducts.length, found: 0 });
    let found = 0;

    for (let i = 0; i < allProducts.length; i += 10) {
      const batch = allProducts.slice(i, i + 10);
      try {
        const { data, error } = await supabase.functions.invoke('fetch-mci-image', {
          body: { products: batch },
        });
        if (error) throw error;
        if (data?.success && data.results) {
          for (const result of data.results) {
            if (result.image_url) {
              await db.from('products').update({ image_url: result.image_url }).eq('id', result.id);
              found++;
            }
          }
        }
      } catch (err: any) {
        console.error('Batch error:', err);
      }
      setImageProgress({ current: Math.min(i + 10, allProducts.length), total: allProducts.length, found });
    }

    setFetchingImages(false);
    toast.success(`Imagens encontradas: ${found} de ${allProducts.length} produtos`);
    loadProducts();
  };

  const handleScrape = async () => {
    const trimmed = scrapeUrl.trim();
    if (!trimmed) {
      toast.error('Insira uma URL para importar');
      return;
    }
    // Basic URL validation
    let testUrl = trimmed;
    if (!testUrl.startsWith('http')) testUrl = `https://${testUrl}`;
    try { new URL(testUrl); } catch {
      toast.error('URL inválida. Verifique o endereço e tente novamente.');
      return;
    }

    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-product', {
        body: { url: trimmed },
      });

      // supabase.functions.invoke returns error for non-2xx OR network issues
      if (error) {
        // Try to parse body for friendly message
        const msg = data?.error || 'Falha na conexão com o servidor. Tente novamente.';
        toast.error(msg);
        return;
      }

      if (data?.ok === false || (!data?.success && !data?.ok)) {
        toast.error(data?.error || 'Não foi possível extrair dados do produto. Tente preencher manualmente.');
        return;
      }

      if (data?.data) {
        const d = data.data;
        setForm(prev => ({
          ...prev,
          name: d.name || prev.name,
          description: d.description || prev.description,
          image_url: d.image_url || prev.image_url,
          price: d.price || prev.price,
          brand: d.brand || prev.brand,
          sku: d.sku || prev.sku,
        }));
        const fields = [d.name, d.description, d.image_url, d.brand, d.sku].filter(Boolean).length + (d.price > 0 ? 1 : 0);
        if (fields < 6) {
          toast.success(`Importados ${fields} de 6 campos. Complete os demais manualmente.`);
        } else {
          toast.success('Todos os dados importados com sucesso!');
        }
      }
    } catch (err: any) {
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setScraping(false);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const filtered = products.filter((p: any) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display">Produtos</h1>
          <p className="text-muted-foreground text-sm">Gerencie o catálogo de produtos</p>
        </div>
        {(isAdmin || isGestor) && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="gap-2 min-h-[44px] text-sm" onClick={handleFetchImages} disabled={fetchingImages}>
              <ImageDown className="h-4 w-4" />
              {fetchingImages ? 'Buscando...' : 'Buscar Imagens'}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 min-h-[44px]"><Plus className="h-4 w-4" /> Novo Produto</Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editing ? 'Editar Produto' : 'Novo Produto'}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2"><Link className="h-4 w-4" /> Importar do site</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Cole o link do produto..."
                      value={scrapeUrl}
                      onChange={e => setScrapeUrl(e.target.value)}
                    />
                    <Button onClick={handleScrape} disabled={scraping} variant="outline" className="shrink-0 min-h-[44px]">
                      {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Importar'}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome / Título *</Label>
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do produto" />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} placeholder="Número SKU" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código</Label>
                    <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="Código interno" />
                  </div>
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <Input value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} placeholder="Marca" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrição detalhada do produto" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" inputMode="decimal" step="0.01" min={0} value={form.price} onChange={e => setForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>URL da Imagem</Label>
                    <Input value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
                  </div>
                </div>

                {form.image_url && (
                  <div className="flex justify-center p-3 border rounded-lg bg-muted/10">
                    <img src={form.image_url} alt="Preview" className="max-h-32 object-contain rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="min-h-[44px]">Cancelar</Button>
                  <Button onClick={handleSave} className="min-h-[44px]">Salvar Produto</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      {fetchingImages && (
        <div className="mb-4 p-4 rounded-lg border bg-muted/20 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Buscando imagens...</span>
            <span>{imageProgress.current}/{imageProgress.total} • {imageProgress.found} encontradas</span>
          </div>
          <Progress value={(imageProgress.current / imageProgress.total) * 100} />
        </div>
      )}

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex gap-2 text-sm text-muted-foreground">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="min-h-[44px] sm:min-h-0">Anterior</Button>
              <span className="flex items-center px-2">Pág. {page + 1}</span>
              <Button variant="outline" size="sm" disabled={products.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)} className="min-h-[44px] sm:min-h-0">Próxima</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3">Nenhum produto encontrado</p>
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filtered.map((p: any) => (
                <div key={p.id} className="p-3 rounded-lg border bg-muted/30 flex gap-3">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-14 h-14 object-contain rounded shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="w-14 h-14 bg-muted rounded flex items-center justify-center shrink-0">
                      <Image className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.brand || '-'} • {p.code || '-'}</p>
                    <p className="text-sm font-semibold mt-1">{formatCurrency(parseFloat(p.price) || 0)}</p>
                  </div>
                  {(isAdmin || isGestor) && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(p)} className="h-10 w-10">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)} className="h-10 w-10">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Foto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Valor</TableHead>
                  {(isAdmin || isGestor) && <TableHead className="w-20">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-10 h-10 object-contain rounded" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                          <Image className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.sku || '-'}</TableCell>
                    <TableCell className="text-xs">{p.code || '-'}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{p.name}</TableCell>
                    <TableCell>{p.brand || '-'}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(p.price) || 0)}</TableCell>
                    {(isAdmin || isGestor) && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
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
