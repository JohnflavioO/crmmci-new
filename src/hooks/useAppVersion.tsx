import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { clearBrowserCachesAndWorkers, reloadWithCacheBust } from '@/lib/browserRecovery';

const LS_KEY = 'app_version';

export interface AppVersionInfo {
  version: string;
  force_update: boolean;
  message?: string;
}

export function useAppVersion() {
  const [remote, setRemote] = useState<AppVersionInfo | null>(null);
  const [local, setLocal] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_KEY); } catch { return null; }
  });

  const fetchVersion = useCallback(async () => {
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
  }, [local]);

  useEffect(() => {
    fetchVersion();
    const i = setInterval(fetchVersion, 60_000);
    return () => clearInterval(i);
  }, [fetchVersion]);

  const updateNow = useCallback(async () => {
    if (remote?.version) {
      try { localStorage.setItem(LS_KEY, remote.version); } catch {}
    }
    await clearBrowserCachesAndWorkers();
    reloadWithCacheBust();
  }, [remote]);

  const hasUpdate = !!(remote && local && remote.version !== local);

  return { remote, local, hasUpdate, updateNow, refetch: fetchVersion };
}
