import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ComparatorProduct {
  id: string;
  name: string;
  brand: string | null;
  code: string | null;
  sku: string | null;
  price: number | null;
  image_url: string | null;
  category_principal: string | null;
  description: string | null;
  compatibility?: string | null;
}

export interface ComparatorResult {
  product: ComparatorProduct;
  compatibility: number;
  reasons: string[];
  similarities: string[];
  differences: string[];
  pros: string[];
  cons: string[];
  approved: boolean;
}

export interface ComparatorResponse {
  extracted?: Record<string, any>;
  results: ComparatorResult[];
  message?: string;
  cached?: boolean;
  approved_match?: boolean;
  response_time_ms?: number;
  error?: string;
}

export function useEquivalentSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: string): Promise<ComparatorResponse> => {
      const { data, error } = await supabase.functions.invoke('find-equivalent-product', {
        body: { input },
      });
      if (error) throw new Error(error.message || 'Falha na busca');
      if (data?.error) throw new Error(data.error);
      return data as ComparatorResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equivalence_history'] });
    },
  });
}

export function useSearchHistory() {
  return useQuery({
    queryKey: ['equivalence_history'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('equivalence_search_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 60_000,
  });
}

export function useApprovedEquivalences() {
  return useQuery({
    queryKey: ['equivalence_approved'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('product_equivalences')
        .select('*, products:mci_product_id(id, name, brand, image_url, price)')
        .order('approved_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 60_000,
  });
}
