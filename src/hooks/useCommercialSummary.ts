import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CommercialSummary {
  quotes: number;
  approved_count: number;
  pending_count: number;
  rejected_count: number;
  approved_revenue: number;
  forecast_revenue: number;
  avg_ticket: number;
  clients_count: number;
  products_count: number;
  overdue_tasks: number;
  demo_expiring: number;
  inactive_clients: number;
  conversion_rate: number;
}

export function useCommercialSummary(startDate?: string, endDate?: string) {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: ['commercial-summary', user?.id, profile?.company_id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_commercial_summary', {
        p_company_id: profile?.company_id,
        p_user_id: user?.id,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) {
        console.error('Error fetching commercial summary:', error);
        throw error;
      }

      return (data as unknown) as CommercialSummary;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes (as per cache policy for quotes/metrics)
    gcTime: 1000 * 60 * 5,
  });
}
