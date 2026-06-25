import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const LS_SEEN_KEY = 'mci_changelog_last_seen_version';

export interface ChangelogEntry {
  id: string;
  version: string;
  release_date: string;
  title: string;
  description: string;
  environment: string;
  created_at: string;
}

export function useChangelog() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSeen, setLastSeen] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_SEEN_KEY); } catch { return null; }
  });

  const fetchChangelog = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    const { data } = await (supabase as any)
      .from('app_changelog')
      .select('*')
      .order('release_date', { ascending: false })
      .order('created_at', { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }, [session]);

  useEffect(() => { fetchChangelog(); }, [fetchChangelog]);

  const currentVersion = entries[0]?.version ?? null;
  const latest = entries[0] ?? null;
  const hasUnseen = !!(currentVersion && currentVersion !== lastSeen);

  const markSeen = useCallback(() => {
    if (!currentVersion) return;
    try { localStorage.setItem(LS_SEEN_KEY, currentVersion); } catch {}
    setLastSeen(currentVersion);
  }, [currentVersion]);

  return { entries, latest, currentVersion, hasUnseen, loading, markSeen, refetch: fetchChangelog };
}
