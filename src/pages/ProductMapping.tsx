import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Link2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type Product = {
  id: string;
  name: string;
  code: string | null;
  sku: string | null;
  brand: string | null;
  loja_integrada_id: string | null;
  needs_manual_link: boolean | null;
  sync_candidates: any[] | null;
  logistica_atualizada_em: string | null;
};

type LICandidate = { id: string; sku: string | null; code: string | null; reference: string | null; name: string; score?: number };

export default function ProductMapping() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<'all' | 'needs_review' | 'not_found' | 'unmapped'>('unmapped');
  const [selected, setSelected] = useState<Product | null>(null);
  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<LICandidate[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id,name,code,sku,brand,loja_integrada_id,needs_manual_link,sync_candidates,logistica_atualizada_em')
      .order('name');
    if (error) toast.error(error.message);
    setProducts((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (filter === 'needs_review') return p.needs_manual_link;
      if (filter === 'not_found') return !p.loja_integrada_id && !p.needs_manual_link && !p.logistica_atualizada_em;
      if (filter === 'unmapped') return !p.loja_integrada_id;
      return true;
    });
  }, [products, filter]);

  const openMap = (p: Product) => {
    setSelected(p);
    setTerm(p.name);
    setResults(Array.isArray(p.sync_candidates) ? (p.sync_candidates as any) : []);
  };

  const doSearch = async () => {
    if (!selected || term.trim().length < 2) return;
    setSearching(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke('loja-integrada', {
        body: { action: 'search_li_products', search_term: term.trim() },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Falha na busca');
      setResults(data.results || []);
      if (!data.results?.length) toast.info('Nenhum resultado encontrado.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSearching(false);
    }
  };

  const link = async (cand: LICandidate) => {
    if (!selected) return;
    setLinking(cand.id);
    try {
      const { data, error } = await supabase.functions.invoke('loja-integrada', {
        body: { action: 'link_product', product_id: selected.id, li_id: cand.id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Falha ao vincular');
      toast.success(data.dims_synced ? 'Vinculado e dimensões sincronizadas!' : 'Vinculado. Loja Integrada não possui dimensões cadastradas.');
      setSelected(null);
      setResults([]);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLinking(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Mapeamento de Produtos</h1>
          <p className="text-sm text-muted-foreground">Vincule manualmente produtos do CRM aos produtos da Loja Integrada. Uma vez salvo, o vínculo é permanente.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { k: 'unmapped', label: 'Sem vínculo', badge: products.filter(p => !p.loja_integrada_id).length },
            { k: 'needs_review', label: 'Necessita validação', badge: products.filter(p => p.needs_manual_link).length },
            { k: 'not_found', label: 'Sem correspondência', badge: products.filter(p => !p.loja_integrada_id && !p.needs_manual_link && !p.logistica_atualizada_em).length },
            { k: 'all', label: 'Todos', badge: products.length },
          ].map(t => (
            <Button key={t.k} size="sm" variant={filter === t.k ? 'default' : 'outline'} onClick={() => setFilter(t.k as any)}>
              {t.label} <Badge variant="secondary" className="ml-2">{t.badge}</Badge>
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Produtos ({filtered.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : (
                <div className="max-h-[600px] overflow-auto divide-y">
                  {filtered.slice(0, 300).map(p => (
                    <button
                      key={p.id}
                      onClick={() => openMap(p)}
                      className={`w-full text-left p-3 hover:bg-muted/50 transition ${selected?.id === p.id ? 'bg-muted' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {p.sku || '—'} · Código: {p.code || '—'} · {p.brand || '—'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {p.loja_integrada_id && <Badge className="bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Vinculado</Badge>}
                          {p.needs_manual_link && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Validar</Badge>}
                        </div>
                      </div>
                    </button>
                  ))}
                  {filtered.length > 300 && <p className="p-3 text-xs text-muted-foreground text-center">Mostrando 300 de {filtered.length}. Refine com filtros.</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Buscar na Loja Integrada</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Selecione um produto à esquerda para buscar equivalentes.</p>
              ) : (
                <>
                  <div className="rounded-md bg-muted/40 p-3 text-xs">
                    <p className="font-medium">{selected.name}</p>
                    <p className="text-muted-foreground">SKU: {selected.sku || '—'} · Código: {selected.code || '—'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Input value={term} onChange={e => setTerm(e.target.value)} placeholder="Busque por nome, SKU ou código" onKeyDown={e => e.key === 'Enter' && doSearch()} />
                    <Button onClick={doSearch} disabled={searching}>
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="max-h-[500px] overflow-auto space-y-2">
                    {results.map(r => (
                      <div key={r.id} className="border rounded-md p-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{r.name}</p>
                            <p className="text-muted-foreground">
                              ID: {r.id} · SKU: {r.sku || '—'} · Código: {r.code || '—'} · Ref: {r.reference || '—'}
                              {r.score !== undefined && <> · Similaridade: {Math.round(r.score * 100)}%</>}
                            </p>
                          </div>
                          <Button size="sm" onClick={() => link(r)} disabled={linking === r.id}>
                            {linking === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
                            Vincular
                          </Button>
                        </div>
                      </div>
                    ))}
                    {!searching && results.length === 0 && (
                      <p className="text-xs text-muted-foreground p-3">Sem resultados. Ajuste o termo de busca.</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
