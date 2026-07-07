import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Play, AlertTriangle, CheckCircle2, XCircle, Package } from 'lucide-react';
import { toast } from 'sonner';

type Product = {
  id: string;
  name: string;
  code: string | null;
  sku: string | null;
  peso_kg: number | null;
  altura_cm: number | null;
  largura_cm: number | null;
  comprimento_cm: number | null;
  loja_integrada_id: string | null;
  loja_integrada_sync_source: string | null;
  logistica_atualizada_em: string | null;
  bloquear_atualizacao_logistica: boolean | null;
};

type LogEntry = { ts: string; level: 'info' | 'ok' | 'warn' | 'err'; msg: string };

const BATCH = 25;

export default function LogisticsSyncDiagnostic() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastResult, setLastResult] = useState<any>(null);
  const [notFound, setNotFound] = useState<{ id: string; name: string; sku: string | null }[]>([]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id,name,code,sku,peso_kg,altura_cm,largura_cm,comprimento_cm,loja_integrada_id,loja_integrada_sync_source,logistica_atualizada_em,bloquear_atualizacao_logistica')
      .order('name');
    if (error) toast.error(error.message);
    setProducts((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const total = products.length;
    const synced = products.filter(p => !!p.logistica_atualizada_em).length;
    const withPeso = products.filter(p => p.peso_kg && p.peso_kg > 0).length;
    const withDims = products.filter(p => p.altura_cm && p.largura_cm && p.comprimento_cm).length;
    const semSku = products.filter(p => !p.sku || p.sku.trim() === '').length;
    const semCorrespondencia = products.filter(p => !p.loja_integrada_id && !!p.logistica_atualizada_em === false).length;
    const bloqueados = products.filter(p => p.bloquear_atualizacao_logistica).length;
    const pendentes = total - synced;
    return { total, synced, pendentes, withPeso, withDims, semPeso: total - withPeso, semDims: total - withDims, semSku, semCorrespondencia, bloqueados };
  }, [products]);

  const pushLog = (level: LogEntry['level'], msg: string) =>
    setLogs(prev => [...prev, { ts: new Date().toLocaleTimeString(), level, msg }].slice(-500));

  const runSync = async (mode: 'all' | 'pending') => {
    setRunning(true);
    setLogs([]);
    setProgress(0);
    setProcessed(0);
    setNotFound([]);

    const target = products.filter(p => !p.bloquear_atualizacao_logistica && (mode === 'all' || !p.logistica_atualizada_em));
    pushLog('info', `Iniciando sincronização de ${target.length} produtos (modo: ${mode}).`);

    let totalUpdated = 0, totalNotFound = 0, totalSkipped = 0, totalErrors = 0;
    const allNotFound: any[] = [];

    for (let i = 0; i < target.length; i += BATCH) {
      const slice = target.slice(i, i + BATCH);
      const ids = slice.map(p => p.id);
      pushLog('info', `Lote ${Math.floor(i / BATCH) + 1}: ${ids.length} produtos...`);
      try {
        const { data, error } = await supabase.functions.invoke('loja-integrada', {
          body: { action: 'sync_product_dimensions', product_ids: ids },
        });
        if (error) {
          pushLog('err', `Erro no lote: ${error.message}`);
          totalErrors += ids.length;
        } else if (!data?.ok) {
          pushLog('err', `Falha: ${data?.error || 'desconhecida'}`);
          totalErrors += ids.length;
        } else {
          totalUpdated += data.updated || 0;
          totalNotFound += data.not_found || 0;
          totalSkipped += data.skipped || 0;
          totalErrors += data.errors || 0;
          if (data.not_found_details?.length) allNotFound.push(...data.not_found_details);
          pushLog('ok', `Lote OK — atualizados: ${data.updated}, sem match: ${data.not_found}, sem dims: ${data.skipped}, erros: ${data.errors}`);
        }
      } catch (e: any) {
        pushLog('err', `Exceção: ${e.message}`);
        totalErrors += ids.length;
      }
      setProcessed(i + slice.length);
      setProgress(Math.round(((i + slice.length) / target.length) * 100));
    }

    setLastResult({ updated: totalUpdated, not_found: totalNotFound, skipped: totalSkipped, errors: totalErrors, total: target.length });
    setNotFound(allNotFound.slice(0, 20));
    pushLog('ok', `Concluído. Atualizados: ${totalUpdated}, Sem match: ${totalNotFound}, Sem dimensões: ${totalSkipped}, Erros: ${totalErrors}`);
    toast.success(`Sincronização finalizada: ${totalUpdated} atualizados`);
    setRunning(false);
    await load();
  };

  const StatCard = ({ label, value, tone, icon: Icon }: any) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${tone || ''}`}>{value}</p>
          </div>
          {Icon && <Icon className="h-8 w-8 text-muted-foreground opacity-40" />}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Diagnóstico da Sincronização Logística</h1>
            <p className="text-sm text-muted-foreground">Audite quais produtos possuem peso e dimensões vindos da Loja Integrada.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading || running}>
              <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
            </Button>
            <Button onClick={() => runSync('pending')} disabled={running || loading} variant="secondary">
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Sincronizar pendentes
            </Button>
            <Button onClick={() => runSync('all')} disabled={running || loading}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Executar sincronização agora
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total de produtos" value={stats.total} icon={Package} />
          <StatCard label="Sincronizados" value={stats.synced} tone="text-emerald-600" icon={CheckCircle2} />
          <StatCard label="Pendentes" value={stats.pendentes} tone="text-amber-600" icon={AlertTriangle} />
          <StatCard label="Sem SKU" value={stats.semSku} tone="text-slate-600" />
          <StatCard label="Sem peso" value={stats.semPeso} tone="text-red-600" />
          <StatCard label="Sem dimensões" value={stats.semDims} tone="text-red-600" />
        </div>

        {running && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Progresso</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">{processed} de {products.length} processados ({progress}%)</p>
            </CardContent>
          </Card>
        )}

        {lastResult && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Resultado da última execução</CardTitle></CardHeader>
            <CardContent className="flex gap-2 flex-wrap">
              <Badge variant="default" className="bg-emerald-600">Atualizados: {lastResult.updated}</Badge>
              <Badge variant="secondary">Sem match na Loja Integrada: {lastResult.not_found}</Badge>
              <Badge variant="secondary">Sem dimensões na origem: {lastResult.skipped}</Badge>
              <Badge variant="destructive">Erros: {lastResult.errors}</Badge>
              <Badge variant="outline">Total processado: {lastResult.total}</Badge>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Log detalhado</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72 overflow-auto bg-slate-950 text-slate-100 rounded-md p-3 font-mono text-xs space-y-1">
                {logs.length === 0 && <p className="text-slate-500">Aguardando execução...</p>}
                {logs.map((l, i) => (
                  <div key={i} className={
                    l.level === 'err' ? 'text-red-400' :
                    l.level === 'warn' ? 'text-amber-300' :
                    l.level === 'ok' ? 'text-emerald-400' : 'text-slate-300'
                  }>
                    [{l.ts}] {l.msg}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Produtos sem correspondência (primeiros 20)</CardTitle></CardHeader>
            <CardContent>
              {notFound.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum registro. Execute a sincronização para identificar produtos não relacionados.</p>
              ) : (
                <div className="max-h-72 overflow-auto space-y-2">
                  {notFound.map(nf => (
                    <div key={nf.id} className="border rounded-md p-2 text-xs">
                      <p className="font-medium">{nf.name}</p>
                      <p className="text-muted-foreground">SKU: {nf.sku || '—'} · ID: {nf.id}</p>
                      <p className="text-red-600">Motivo: nenhuma correspondência por external_id, SKU, código ou nome.</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Status individual (primeiros 100)</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left border-b">
                    <th className="p-2">Produto</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Código</th>
                    <th className="p-2">Peso</th>
                    <th className="p-2">Dim (AxLxC)</th>
                    <th className="p-2">Match por</th>
                    <th className="p-2">Sincronizado</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 100).map(p => {
                    const hasDims = p.altura_cm && p.largura_cm && p.comprimento_cm;
                    return (
                      <tr key={p.id} className="border-b hover:bg-muted/40">
                        <td className="p-2">{p.name}</td>
                        <td className="p-2">{p.sku || <span className="text-red-600">—</span>}</td>
                        <td className="p-2">{p.code || '—'}</td>
                        <td className="p-2">{p.peso_kg ? `${p.peso_kg} kg` : <XCircle className="h-3 w-3 text-red-500 inline" />}</td>
                        <td className="p-2">{hasDims ? `${p.altura_cm}×${p.largura_cm}×${p.comprimento_cm}` : <XCircle className="h-3 w-3 text-red-500 inline" />}</td>
                        <td className="p-2">{p.loja_integrada_sync_source || '—'}</td>
                        <td className="p-2">{p.logistica_atualizada_em ? new Date(p.logistica_atualizada_em).toLocaleString('pt-BR') : <span className="text-amber-600">Pendente</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
