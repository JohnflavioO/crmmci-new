import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { clearBrowserCachesAndWorkers, reloadWithCacheBust } from '@/lib/browserRecovery';
import { useAuth } from '@/hooks/useAuth';

const LS_KEY = 'app_version';

const isPreviewRuntime = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return window.self !== window.top
    || host.startsWith('id-preview--')
    || host.includes('-preview--')
    || host.includes('lovable.app')
    || host.endsWith('.lovableproject.com');
};

export interface AppVersionInfo {
  version: string;
  force_update: boolean;
  message?: string;
}

export function useAppVersion() {
  const { session } = useAuth();
  const [remote, setRemote] = useState<AppVersionInfo | null>(null);
  const [local, setLocal] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_KEY); } catch { return null; }
  });

  const fetchVersion = useCallback(async () => {
    if (!session) return;

    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'app_version')
      .maybeSingle();
    if (data?.value) {
      const v = data.value as unknown as AppVersionInfo;
      setRemote(v);
      // First load: store baseline silently
      if (!local) {
        try { localStorage.setItem(LS_KEY, v.version); } catch {}
        setLocal(v.version);
      }
    }
  }, [local, session]);

  useEffect(() => {
    if (!session) return;

    fetchVersion();
    const i = setInterval(fetchVersion, 60_000);
    return () => clearInterval(i);
  }, [fetchVersion, session]);

  const updateNow = useCallback(async () => {
    if (remote?.version) {
      try { localStorage.setItem(LS_KEY, remote.version); } catch {}
      setLocal(remote.version);
    }

    if (!isPreviewRuntime()) {
      try { await clearBrowserCachesAndWorkers(); } catch {}
      try {
        reloadWithCacheBust();
      } catch {}
    }

    setTimeout(() => {
      try { window.location.reload(); } catch {}
    }, 150);
  }, [remote]);

  const hasUpdate = !!(remote && local && remote.version !== local);

  return { remote, local, hasUpdate, updateNow, refetch: fetchVersion };
}
