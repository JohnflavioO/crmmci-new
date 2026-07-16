import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CheckCircle2, ExternalLink, Plus, Layers, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ComparatorResult } from '@/hooks/useEquivalentSearch';

interface Props {
  result: ComparatorResult;
  externalInfo?: { brand?: string; model?: string; url?: string; input?: string };
  onAdd: () => void;
}

const compatColor = (v: number) => {
  if (v >= 90) return 'bg-emerald-500';
  if (v >= 75) return 'bg-lime-500';
  if (v >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
};

const TIER_META: Record<string, { label: string; className: string }> = {
  equivalente_direto: { label: 'Equivalente direto', className: 'bg-emerald-600 text-white' },
  alternativa_superior: { label: 'Alternativa superior', className: 'bg-sky-600 text-white' },
  alternativa_economica: { label: 'Alternativa econômica', className: 'bg-amber-500 text-white' },
  relacionado: { label: 'Produto relacionado', className: 'bg-slate-500 text-white' },
};

const currency = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ResultCard({ result, externalInfo, onAdd }: Props) {
  const [showCompare, setShowCompare] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const p = result.product;

  const confirmEquivalence = async () => {
    setConfirming(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error('sem sessão');
      const { error } = await (supabase as any).from('product_equivalences').insert({
        produto_externo: externalInfo?.input ?? externalInfo?.model ?? null,
        marca_externa: externalInfo?.brand ?? null,
        modelo_externo: externalInfo?.model ?? null,
        url_externa: externalInfo?.url ?? null,
        mci_product_id: p.id,
        confidence: result.compatibility,
        approved_by: uid,
        notes: (result.reasons ?? []).join(' • '),
      });
      if (error) throw error;
      toast.success('Equivalência salva. Será usada em buscas futuras.');
    } catch (e: any) {
      toast.error('Falha ao salvar: ' + (e?.message ?? 'erro'));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-border/70 hover:border-primary/50 transition-colors">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex gap-4">
            <div className="w-24 h-24 shrink-0 rounded-md bg-muted/40 border overflow-hidden flex items-center justify-center">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" />
              ) : (
                <Layers className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.brand ?? 'Sem marca'} {p.code ? `• ${p.code}` : ''} {p.sku ? `• SKU ${p.sku}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {result.tier && TIER_META[result.tier] && (
                    <Badge className={`gap-1 ${TIER_META[result.tier].className}`}>{TIER_META[result.tier].label}</Badge>
                  )}
                  {result.approved && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Aprovado
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Compatibilidade</span>
                    <span className="font-semibold">{result.compatibility}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${compatColor(result.compatibility)}`} style={{ width: `${result.compatibility}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Preço</p>
                  <p className="text-sm font-semibold">{currency(p.price)}</p>
                </div>
              </div>
            </div>
          </div>

          {result.reasons && result.reasons.length > 0 && (
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5 pl-1">
              {result.reasons.slice(0, 3).map((r, i) => (<li key={i}>{r}</li>))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar ao orçamento
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCompare(true)}>
              <Layers className="h-4 w-4 mr-1" /> Comparar detalhes
            </Button>
            {!result.approved && (
              <>
                <Button size="sm" variant="ghost" onClick={confirmEquivalence} disabled={confirming}>
                  <Sparkles className="h-4 w-4 mr-1" /> É o equivalente
                </Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => toast.info('Obrigado pelo feedback. Ajuste registrado para calibrarmos próximas buscas.')}>
                  Não é equivalente
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={showCompare} onOpenChange={setShowCompare}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Comparação detalhada</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-md p-3">
                <p className="text-[10px] uppercase text-muted-foreground">Pesquisado</p>
                <p className="font-semibold">{externalInfo?.brand ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{externalInfo?.model ?? externalInfo?.input ?? ''}</p>
              </div>
              <div className="border rounded-md p-3">
                <p className="text-[10px] uppercase text-muted-foreground">Equivalente MCI</p>
                <p className="font-semibold">{p.brand ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{p.name}</p>
              </div>
            </div>

            {result.similarities?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-1">Semelhanças</p>
                <ul className="text-xs list-disc list-inside space-y-0.5">
                  {result.similarities.map((s, i) => (<li key={i}>{s}</li>))}
                </ul>
              </div>
            )}
            {result.differences?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-1">Diferenças</p>
                <ul className="text-xs list-disc list-inside space-y-0.5">
                  {result.differences.map((s, i) => (<li key={i}>{s}</li>))}
                </ul>
              </div>
            )}
            {result.pros?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-primary mb-1">Vantagens</p>
                <ul className="text-xs list-disc list-inside space-y-0.5">
                  {result.pros.map((s, i) => (<li key={i}>{s}</li>))}
                </ul>
              </div>
            )}
            {result.cons?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-rose-600 mb-1">Desvantagens</p>
                <ul className="text-xs list-disc list-inside space-y-0.5">
                  {result.cons.map((s, i) => (<li key={i}>{s}</li>))}
                </ul>
              </div>
            )}

            {p.description && (
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold mb-1">Descrição do produto MCI</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{p.description}</p>
              </div>
            )}
            {externalInfo?.url && (
              <a href={externalInfo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> Abrir origem
              </a>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
