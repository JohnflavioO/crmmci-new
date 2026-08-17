import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ClientRankingSummary {
  total_clients: number;
  active_clients: number;
  recurrent_clients: number;
  total_revenue: number;
  period_days: number | string;
  scope: string;
}

export interface ClientRankingRow {
  client_id: string;
  client_name: string;
  cnpj: string;
  city: string;
  state: string;
  salesperson: string;
  quotes_count: number;
  total_value: number;
  received_value: number;
  first_purchase: string | null;
  last_purchase: string | null;
  ticket_medio: number;
  days_since_last: number | null;
  interval_avg_days: number | null;
  is_active: boolean;
  is_recurrent: boolean;
  status: 'verde' | 'amarelo' | 'vermelho';
  top_products: Array<{ qty: number; value: number; name: string; brand: string }>;
  monthly: Record<string, number>;
  brands: Record<string, number>;
}

export function useClientRanking(args: {
  scope?: 'own' | 'team';
  period_days?: number | 'all';
  seller_id?: string;
  state?: string;
  city?: string;
  only_recurrent?: boolean;
  active_filter?: 'all' | 'active' | 'inactive';
  limit?: number;
}) {
  const { user, isGestor, isAdmin } = useAuth();
  const canSeeTeam = isGestor || isAdmin;
  const effectiveScope = (args.scope === 'team' && canSeeTeam) ? 'team' : 'own';

  return useQuery({
    queryKey: ['client-ranking', user?.id, { ...args, scope: effectiveScope }],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('crm-tools', {
        body: {
          tool: 'get_client_ranking',
          args: {
            ...args,
            scope: effectiveScope,
            seller_id: args.seller_id === 'all' ? undefined : args.seller_id,
            state: args.state === 'all' ? undefined : args.state,
            city: args.city === 'all' ? undefined : args.city,
          }
        },
      });
      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      return {
        rows: data.rows as ClientRankingRow[],
        summary: data.summary as ClientRankingSummary
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });
}
