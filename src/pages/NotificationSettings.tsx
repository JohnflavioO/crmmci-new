import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bell, Smartphone, Volume2, VolumeX, Send, RefreshCw, Trash2, ShieldCheck, Activity, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { requestNotificationPermission, getFcmDiagnostics, markFcmTestPerformed, type FcmDiagnostics } from '@/lib/firebase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNotifications } from '@/contexts/NotificationsContext';
import { logger } from '@/lib/logger';

const db = supabase as any;

interface Device {
  id: string;
  fcm_token: string;
  device_type: string | null;
  browser: string | null;
  last_seen_at: string;
  is_active: boolean;
}

export default function NotificationSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { preferences, setPreference } = useNotifications();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [diag, setDiag] = useState<FcmDiagnostics | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const loadDevices = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await db
      .from('user_push_tokens')
      .select('*')
      .eq('user_id', user.id)
      .order('last_seen_at', { ascending: false });
    setDevices(data || []);
    setLoading(false);
  };

  const runDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const d = await getFcmDiagnostics();
      setDiag(d);
    } finally {
      setDiagLoading(false);
    }
  };

  useEffect(() => { loadDevices(); runDiagnostics(); }, [user]);

  const handleEnablePush = async () => {
    try {
      await requestNotificationPermission();
      setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default');
      toast.success('Push ativado e dispositivo registrado!');
      await loadDevices();
      await runDiagnostics();
    } catch (e: any) {
      setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default');
      toast.error(`[${e?.code || 'erro'}] ${e?.message || 'Falha ao ativar push'}`, { duration: 8000 });
      await runDiagnostics();
    }
  };

  const handleTest = async () => {
    if (!user) return;
    setTesting(true);
    try {
      const { error } = await db.from('notifications').insert({
        user_id: user.id,
        title: '🔔 Notificação de teste',
        message: 'Se você está vendo isso, sua Central de Notificações está funcionando.',
        type: 'test',
        priority: 'normal',
        module: 'configuracoes',
        is_read: false,
      });
      if (error) throw error;

      try {
        const { error: pushErr } = await supabase.functions.invoke('send-push-notifications', {
          body: {
            action: 'send_push',
            notification: {
              userId: user.id,
              title: '🔔 Notificação de teste',
              body: 'Push do MCI CRM chegou no seu navegador.',
              data: { url: '/configuracoes/notificacoes' },
            },
          },
        });
        if (pushErr) logger.warn('Push test error:', pushErr);
      } catch (e) {
        logger.warn('Push test invoke failed:', e);
      }

      markFcmTestPerformed();
      await runDiagnostics();
      toast.success('Notificação de teste enviada!');
    } catch (e: any) {
      toast.error(`[${e?.code || 'erro'}] ${e?.message || 'Falha ao enviar teste'}`, { duration: 8000 });
    } finally {
      setTesting(false);
    }
  };

  const removeDevice = async (id: string) => {
    await db.from('user_push_tokens').delete().eq('id', id);
    setDevices(prev => prev.filter(d => d.id !== id));
    toast.success('Dispositivo removido');
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6" /> Notificações
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie como e onde você recebe alertas do MCI CRM.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>Voltar</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferências</CardTitle>
            <CardDescription>Controle global da central interna e do som. Sincronizado entre dispositivos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Notificações internas</Label>
                <p className="text-xs text-muted-foreground">Sino, badge e realtime dentro do CRM.</p>
              </div>
              <Switch
                checked={preferences.notifications_enabled}
                onCheckedChange={(v) => setPreference({ notifications_enabled: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium flex items-center gap-2">
                  {preferences.sound_enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Som
                </Label>
                <p className="text-xs text-muted-foreground">Reproduzir som ao chegar novas notificações.</p>
              </div>
              <Switch
                checked={preferences.sound_enabled}
                onCheckedChange={(v) => setPreference({ sound_enabled: v })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Push do navegador (Firebase FCM)
            </CardTitle>
            <CardDescription>
              Status atual:{' '}
              <Badge variant={permission === 'granted' ? 'default' : permission === 'denied' ? 'destructive' : 'secondary'}>
                {permission === 'granted' ? 'Permitido' : permission === 'denied' ? 'Bloqueado' : 'Não solicitado'}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleEnablePush} disabled={permission === 'granted'}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                {permission === 'granted' ? 'Push ativo' : 'Ativar push do navegador'}
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                <Send className="h-4 w-4 mr-2" /> {testing ? 'Enviando...' : 'Testar notificação'}
              </Button>
            </div>
            {permission === 'denied' && (
              <p className="text-xs text-destructive">
                Push foi bloqueado neste navegador. Abra as permissões do site e libere "Notificações".
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Diagnóstico FCM
              </CardTitle>
              <CardDescription>Verificação completa do fluxo de push.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={runDiagnostics} disabled={diagLoading}>
              <RefreshCw className={`h-4 w-4 ${diagLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {!diag ? (
              <p className="text-sm text-muted-foreground">Executando diagnóstico…</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                <DiagRow ok={diag.isSecureContext} label="Contexto seguro (HTTPS)" />
                <DiagRow ok={diag.notificationApi} label="Notification API disponível" />
                <DiagRow
                  ok={diag.permission === 'granted'}
                  warn={diag.permission === 'default'}
                  label={`Permissão do navegador: ${diag.permission}`}
                />
                <DiagRow ok={diag.serviceWorkerApi} label="Service Worker API disponível" />
                <DiagRow
                  ok={diag.serviceWorkerRegistered}
                  label={`Service Worker registrado${diag.serviceWorkerScope ? ` (${diag.serviceWorkerScope})` : ''}`}
                />
                <DiagRow ok={diag.firebaseInitialized} label="Firebase inicializado" />
                <DiagRow ok={diag.messagingSupported} label="Firebase Messaging suportado" />
                <DiagRow ok={diag.vapidConfigured} label="VAPID Key configurada" />
                <DiagRow
                  ok={diag.tokenObtained}
                  label={`Token FCM obtido${diag.tokenPreview ? ` (${diag.tokenPreview})` : ''}`}
                />
                <DiagRow ok={diag.tokenSavedInDb} label="Token salvo no banco (user_push_tokens)" />
                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <span className="font-medium">Device ID:</span>
                  <span className="font-mono">{diag.deviceId}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">Último teste:</span>
                  <span>
                    {diag.lastTestAt
                      ? formatDistanceToNow(new Date(diag.lastTestAt), { addSuffix: true, locale: ptBR })
                      : 'nunca'}
                  </span>
                </div>
                {diag.errors.length > 0 && (
                  <div className="mt-2 p-2 rounded border border-destructive/40 bg-destructive/5 text-xs text-destructive space-y-1">
                    {diag.errors.map((e, i) => (<div key={i}>• {e}</div>))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4" /> Dispositivos conectados
              </CardTitle>
              <CardDescription>Navegadores e celulares que recebem suas notificações push.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={loadDevices} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum dispositivo registrado. Clique em "Ativar push do navegador" acima.
              </p>
            ) : (
              <div className="space-y-2">
                {devices.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={d.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {d.device_type || 'desktop'}
                        </Badge>
                        <span className="text-sm font-medium truncate">
                          {(d.browser || '').split(' ').slice(0, 4).join(' ') || 'Navegador'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Última sincronização: {formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true, locale: ptBR })}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                        {d.fcm_token.slice(0, 24)}…
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeDevice(d.id)} aria-label="Remover dispositivo">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
