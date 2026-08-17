import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SalesMetrics {
  approved_count: number;
  revenue_total: number;
  average_ticket: number;
  period: { from: string | null; to: string | null };
}

export interface PipelineSummary {
  [status: string]: {
    count: number;
    value: number;
    items: any[];
  };
}

export function useDashboardHandlers(args: { 
  scope?: 'own' | 'team'; 
  days_back?: number;
  from?: string;
  to?: string;
}) {
  const { user, profile, isGestor, isAdmin } = useAuth();
  const canSeeTeam = isGestor || isAdmin;
  const effectiveScope = (args.scope === 'team' && canSeeTeam) ? 'team' : 'own';

  const metricsQuery = useQuery({
    queryKey: ['dashboard-metrics', user?.id, args],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('crm-tools', {
        body: { 
          tool: 'get_sales_metrics', 
          args: { 
            scope: effectiveScope,
            days_back: args.days_back,
            from: args.from,
            to: args.to
          } 
        },
      });
      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      return data.summary as SalesMetrics;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const pipelineQuery = useQuery({
    queryKey: ['dashboard-pipeline', user?.id, args],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('crm-tools', {
        body: { 
          tool: 'get_pipeline', 
          args: { scope: effectiveScope } 
        },
      });
      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      return data.summary as PipelineSummary;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  return {
    metrics: metricsQuery.data,
    pipeline: pipelineQuery.data,
    loading: metricsQuery.isLoading || pipelineQuery.isLoading,
    error: metricsQuery.error || pipelineQuery.error,
    refetch: () => {
      metricsQuery.refetch();
      pipelineQuery.refetch();
    }
  };
}
