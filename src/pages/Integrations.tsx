import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw, Eye, EyeOff, ShoppingBag, Plug, Download } from 'lucide-react';

type IntegrationStatus = 'disconnected' | 'connected' | 'error' | 'syncing';

const statusConfig: Record<IntegrationStatus, { label: string; color: string; icon: any }> = {
  disconnected: { label: 'Não conectada', color: 'bg-muted text-muted-foreground', icon: XCircle },
  connected: { label: 'Conectada', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  error: { label: 'Erro de autenticação', color: 'bg-destructive/10 text-destructive', icon: AlertCircle },
  syncing: { label: 'Sincronizando...', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Loader2 },
};

interface SyncOrder {
  id: string;
  status: string;
  client_name: string;
  client_email: string;
  total: number;
  date: string;
}

export default function Integrations() {
  const { isAdmin } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [applicationKey, setApplicationKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAppKey, setShowAppKey] = useState(false);
  const [status, setStatus] = useState<IntegrationStatus>('disconnected');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [orders, setOrders] = useState<SyncOrder[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [syncPage, setSyncPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);

  useEffect(() => {
    if (isAdmin) loadStatus();
  }, [isAdmin]);

  const callFunction = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('loja-integrada', { body });
    if (error) throw new Error(error.message || 'Erro na função');
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await callFunction({ action: 'status' });
      setStatus(data.status as IntegrationStatus || 'disconnected');
      setLastSync(data.last_sync_at);
      setHasCredentials(data.has_credentials);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!apiKey || !applicationKey) {
      toast.error('Preencha as duas chaves para testar');
      return;
    }
    setTesting(true);
    try {
      const data = await callFunction({ action: 'test', api_key: apiKey, application_key: applicationKey });
      toast.success(`Conexão OK! ${data.total_orders} pedidos encontrados.`);
    } catch (e: any) {
      toast.error('Falha na conexão: ' + (e.message || 'Erro desconhecido'));
      setStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey || !applicationKey) {
      toast.error('Preencha as duas chaves');
      return;
    }
    setSaving(true);
    try {
      await callFunction({ action: 'save', api_key: apiKey, application_key: applicationKey });
      toast.success('Integração salva com sucesso!');
      setStatus('connected');
      setHasCredentials(true);
      setApiKey('');
      setApplicationKey('');
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (page = 1) => {
    setSyncing(true);
    setStatus('syncing');
    try {
      const data = await callFunction({ action: 'sync', page });
      setOrders(prev => page === 1 ? data.orders : [...prev, ...data.orders]);
      setTotalOrders(data.total_count);
      setSyncPage(data.page);
      setHasMore(data.has_more);
      setStatus('connected');
      setLastSync(new Date().toISOString());
      toast.success(`${data.orders.length} pedidos carregados (total: ${data.total_count})`);
    } catch (e: any) {
      setStatus('error');
      toast.error('Erro na sincronização: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setSyncing(false);
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Acesso restrito ao administrador.</p>
        </div>
      </AppLayout>
    );
  }

  const StatusIcon = statusConfig[status].icon;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">Integrações</h1>
            <p className="text-sm text-muted-foreground">Gerencie as integrações externas do CRM</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Loja Integrada</CardTitle>
              <CardDescription>Sincronize pedidos e vendas da sua loja virtual</CardDescription>
            </div>
            <Badge className={statusConfig[status].color}>
              <StatusIcon className={`h-3.5 w-3.5 mr-1 ${status === 'syncing' ? 'animate-spin' : ''}`} />
              {statusConfig[status].label}
            </Badge>
          </CardHeader>

          <CardContent className="space-y-6">
            {lastSync && (
              <p className="text-xs text-muted-foreground">
                Última sincronização: {new Date(lastSync).toLocaleString('pt-BR')}
              </p>
            )}

            {/* Credentials form */}
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <Plug className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {hasCredentials ? 'Atualizar credenciais' : 'Configurar credenciais'}
                </h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs">Application Key</Label>
                  <div className="relative">
                    <Input
                      type={showAppKey ? 'text' : 'password'}
                      value={applicationKey}
                      onChange={e => setApplicationKey(e.target.value)}
                      placeholder="Sua Application Key"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAppKey(!showAppKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showAppKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">API Key</Label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="Sua API Key"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !apiKey || !applicationKey}>
                  {testing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Testar conexão
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !apiKey || !applicationKey}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Salvar integração
                </Button>
              </div>
            </div>

            {/* Sync section */}
            {hasCredentials && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Pedidos da Loja Integrada</h3>
                  <Button variant="outline" size="sm" onClick={() => handleSync(1)} disabled={syncing}>
                    {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Sincronizar pedidos
                  </Button>
                </div>

                {orders.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground">{totalOrders} pedidos encontrados</p>
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nº Pedido</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map((order, i) => (
                            <TableRow key={`${order.id}-${i}`}>
                              <TableCell className="font-medium">{order.id}</TableCell>
                              <TableCell>{order.client_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{order.status}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {typeof order.total === 'number'
                                  ? order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                  : order.total}
                              </TableCell>
                              <TableCell className="text-xs">
                                {order.date ? new Date(order.date).toLocaleDateString('pt-BR') : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {hasMore && (
                      <Button variant="ghost" size="sm" onClick={() => handleSync(syncPage + 1)} disabled={syncing}>
                        Carregar mais
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
