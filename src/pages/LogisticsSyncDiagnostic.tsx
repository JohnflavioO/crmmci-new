import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Play, AlertTriangle, CheckCircle2, XCircle, Package, Link2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const PROVIDER = 'loja_integrada';

type Product = {
  id: string; name: string; code: string | null; sku: string | null;
  peso_kg: number | null; altura_cm: number | null; largura_cm: number | null; comprimento_cm: number | null;
  logistica_atualizada_em: string | null; bloquear_atualizacao_logistica: boolean | null;
};

type ExtLink = { product_id: string; sync_status: string; match_source: string | null; last_sync_at: string | null };
type ExecLog = { id: string; action: string; targets_count: number; linked_count: number; updated_count: number; needs_validation_count: number; not_found_count: number; errors_count: number; duration_ms: number; created_at: string; triggered_by_name: string | null };

type LogEntry = { ts: string; level: 'info' | 'ok' | 'warn' | 'err'; msg: string };
type SmartReport = {
  total: number; linked: number; updated: number; needs_review: number; not_found: number; errors: number; li_catalog_size: number;
  not_found_details?: any[]; needs_review_details?: any[];
} | null;

const BATCH = 25;

export default function LogisticsSyncDiagnostic() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [links, setLinks] = useState<Record<string, ExtLink>>({});
  const [execLogs, setExecLogs] = useState<ExecLog[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [smartReport, setSmartReport] = useState<SmartReport>(null);
  const [smartRunning, setSmartRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [p, l, e] = await Promise.all([
      supabase.from('products').select('id,name,code,sku,peso_kg,altura_cm,largura_cm,comprimento_cm,logistica_atualizada_em,bloquear_atualizacao_logistica').order('name'),
      supabase.from('product_external_links').select('product_id,sync_status,match_source,last_sync_at').eq('provider', PROVIDER),
      supabase.from('sync_execution_logs').select('*').eq('provider', PROVIDER).order('created_at', { ascending: false }).limit(10),
    ]);
    if (p.error) toast.error(p.error.message);
    setProducts((p.data as any) || []);
    const map: Record<string, ExtLink> = {};
    for (const row of (l.data as any[]) || []) map[row.product_id] = row;
    setLinks(map);
    setExecLogs((e.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const total = products.length;
    let linked = 0, needs = 0, notFound = 0, syncedToday = 0, withPeso = 0, withDims = 0, conflicts = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const p of products) {
      const l = links[p.id];
      if (l?.sync_status === 'linked') linked++;
      if (l?.sync_status === 'needs_validation') needs++;
      if (l?.sync_status === 'not_found') notFound++;
      if (l?.sync_status === 'error') conflicts++;
      if (l?.last_sync_at && l.last_sync_at.slice(0, 10) === today) syncedToday++;
      if (p.peso_kg && p.peso_kg > 0) withPeso++;
      if (p.altura_cm && p.largura_cm && p.comprimento_cm) withDims++;
    }
    return {
      total, linked, unlinked: total - linked, needs, notFound, conflicts, syncedToday,
      semPeso: total - withPeso, semDims: total - withDims,
    };
  }, [products, links]);

  const pushLog = (level: LogEntry['level'], msg: string) =>
    setLogs(prev => [...prev, { ts: new Date().toLocaleTimeString(), level, msg }].slice(-500));

  const runSync = async (mode: 'all' | 'unlinked') => {
    setRunning(true); setLogs([]); setProgress(0); setProcessed(0);
    const target = products.filter(p => {
      if (p.bloquear_atualizacao_logistica) return false;
      if (mode === 'all') return true;
      const l = links[p.id];
      return !l || l.sync_status !== 'linked';
    });
    pushLog('info', `Iniciando sincronização de ${target.length} produtos (modo: ${mode}).`);

    let totalUpdated = 0, totalLinked = 0, totalNotFound = 0, totalReview = 0, totalErrors = 0;

    for (let i = 0; i < target.length; i += BATCH) {
      const slice = target.slice(i, i + BATCH);
      const ids = slice.map(p => p.id);
      pushLog('info', `Lote ${Math.floor(i / BATCH) + 1}: ${ids.length} produtos...`);
      try {
        const { data, error } = await supabase.functions.invoke('loja-integrada', {
          body: { action: 'sync_product_dimensions', product_ids: ids },
        });
        if (error) { pushLog('err', `Erro no lote: ${error.message}`); totalErrors += ids.length; }
        else if (!data?.ok) { pushLog('err', `Falha: ${data?.error}`); totalErrors += ids.length; }
        else {
          totalUpdated += data.updated || 0;
          totalLinked += data.linked || 0;
          totalNotFound += data.not_found || 0;
          totalReview += data.needs_review || 0;
          totalErrors += data.errors || 0;
          pushLog('ok', `Lote OK — vinculados: ${data.linked}, atualizados: ${data.updated}, validar: ${data.needs_review}, sem match: ${data.not_found}, erros: ${data.errors}`);
        }
      } catch (e: any) { pushLog('err', `Exceção: ${e.message}`); totalErrors += ids.length; }
      setProcessed(i + slice.length);
      setProgress(Math.round(((i + slice.length) / target.length) * 100));
    }

    pushLog('ok', `Concluído. Vinculados: ${totalLinked}, Dimensões atualizadas: ${totalUpdated}, Aguardando validação: ${totalReview}, Sem match: ${totalNotFound}, Erros: ${totalErrors}`);
    toast.success(`Sincronização finalizada: ${totalLinked} vinculados`);
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
            <p className="text-sm text-muted-foreground">Baseado em <code className="text-xs">product_external_links</code> (provider: Loja Integrada).</p>
          </div>
          <div className="flex gap-2">
            <Link to="/mapeamento-produtos"><Button variant="outline"><Link2 className="h-4 w-4 mr-2" />Mapeamento</Button></Link>
            <Button variant="outline" onClick={load} disabled={loading || running}><RefreshCw className="h-4 w-4 mr-2" />Recarregar</Button>
            <Button onClick={() => runSync('unlinked')} disabled={running || loading} variant="secondary">
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Sincronizar sem vínculo
            </Button>
            <Button onClick={() => runSync('all')} disabled={running || loading}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Executar sincronização agora
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
          <StatCard label="Total de produtos" value={stats.total} icon={Package} />
          <StatCard label="Vinculados" value={stats.linked} tone="text-emerald-600" icon={CheckCircle2} />
          <StatCard label="Sem vínculo" value={stats.unlinked} tone="text-amber-600" icon={AlertTriangle} />
          <StatCard label="Aguardando validação" value={stats.needs} tone="text-red-600" />
          <StatCard label="Sem correspondência" value={stats.notFound} tone="text-slate-600" />
          <StatCard label="Conflitos / erros" value={stats.conflicts} tone="text-red-600" icon={XCircle} />
          <StatCard label="Sincronizados hoje" value={stats.syncedToday} tone="text-emerald-600" />
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Log da execução em andamento</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72 overflow-auto bg-slate-950 text-slate-100 rounded-md p-3 font-mono text-xs space-y-1">
                {logs.length === 0 && <p className="text-slate-500">Aguardando execução...</p>}
                {logs.map((l, i) => (
                  <div key={i} className={
                    l.level === 'err' ? 'text-red-400' :
                    l.level === 'warn' ? 'text-amber-300' :
                    l.level === 'ok' ? 'text-emerald-400' : 'text-slate-300'
                  }>[{l.ts}] {l.msg}</div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Histórico de execuções (últimas 10)</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-72 overflow-auto space-y-2">
                {execLogs.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma execução registrada ainda.</p>}
                {execLogs.map(e => (
                  <div key={e.id} className="border rounded-md p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{e.action}</span>
                      <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap mt-1">
                      <Badge variant="outline">Alvos: {e.targets_count}</Badge>
                      <Badge className="bg-emerald-600">Vinculados: {e.linked_count}</Badge>
                      <Badge variant="secondary">Dims: {e.updated_count}</Badge>
                      <Badge variant="destructive">Validar: {e.needs_validation_count}</Badge>
                      <Badge variant="outline">Sem match: {e.not_found_count}</Badge>
                      <Badge variant="destructive">Erros: {e.errors_count}</Badge>
                      <Badge variant="outline">{e.duration_ms}ms</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
