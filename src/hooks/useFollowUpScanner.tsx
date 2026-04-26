import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { differenceInDays, isToday, isBefore, parseISO, startOfDay } from 'date-fns';

const db = supabase as any;
const ACTIVE_STATUSES = ['sent', 'negociacao', 'negotiation', 'contato_feito', 'contact_made', 'pre_sale', 'pre_venda'];

export function useFollowUpScanner() {
  const { user, isAdmin, isGestor, isFinanceiro, isLogistica } = useAuth();

  const scan = useCallback(async () => {
    // Only Seller, Admin, Gestor
    if (!user || isFinanceiro || isLogistica) return;

    try {
      // 1. Fetch active quotes for the user
      // Vendedor: own only. Admin/Gestor: own by default (system usually filters by created_by = auth.uid() in standard policies)
      const { data: quotes, error: quotesError } = await db
        .from('quotes')
        .select('id, quote_number, status, followup_date, updated_at, created_at, client_name, total_amount')
        .in('status', ACTIVE_STATUSES)
        .eq('created_by', user.id);

      if (quotesError || !quotes) return;

      const now = new Date();
      const today = startOfDay(now);

      for (const quote of quotes) {
        let alertType: 'today' | 'overdue' | 'forgotten' | 'no_return' | null = null;
        let title = '';
        let message = '';

        const followupDateStr = quote.followup_date;
        const lastUpdate = parseISO(quote.updated_at || quote.created_at);
        const daysSinceLastUpdate = differenceInDays(now, lastUpdate);

        // Logic for alerts
        if (followupDateStr) {
          const fDate = parseISO(followupDateStr);
          if (isToday(fDate)) {
            alertType = 'today';
            title = '📌 Follow-up para hoje';
            message = `O orçamento ${quote.quote_number} (${quote.client_name}) tem follow-up agendado para hoje.`;
          } else if (isBefore(fDate, today)) {
            alertType = 'overdue';
            title = '⚠ Follow-up atrasado';
            message = `O follow-up do orçamento ${quote.quote_number} (${quote.client_name}) está vencido desde ${new Date(fDate).toLocaleDateString('pt-BR')}.`;
          }
        } 
        
        // If no follow-up date or interaction is old
        if (!alertType) {
          if (quote.status === 'sent' && daysSinceLastUpdate >= 3) {
            alertType = 'no_return';
            title = '📧 Proposta sem retorno';
            message = `A proposta ${quote.quote_number} foi enviada há ${daysSinceLastUpdate} dias e ainda não teve retorno.`;
          } else if (daysSinceLastUpdate >= 5) {
            alertType = 'forgotten';
            title = '⏳ Orçamento esquecido';
            message = `O orçamento ${quote.quote_number} está sem interação há ${daysSinceLastUpdate} dias.`;
          }
        }

        if (alertType) {
          // Check if already notified today for this type
          const { data: existingLogs } = await db
            .from('followup_notification_logs')
            .select('id')
            .eq('quote_id', quote.id)
            .eq('user_id', user.id)
            .eq('notification_type', alertType)
            .eq('notified_at', now.toISOString().split('T')[0]);

          if (!existingLogs || existingLogs.length === 0) {
            // Create notification
            await Promise.all([
              db.from('notifications').insert({
                user_id: user.id,
                title,
                message,
                type: 'followup',
                related_quote_id: quote.id
              }),
              db.from('followup_notification_logs').insert({
                quote_id: quote.id,
                user_id: user.id,
                notification_type: alertType,
                notified_at: now.toISOString().split('T')[0]
              })
            ]);
          }
        }
      }
    } catch (err) {
      console.error('[FollowUpScanner] Error during scan:', err);
    }
  }, [user, isFinanceiro, isLogistica]);

  useEffect(() => {
    // Initial scan on load
    const timeout = setTimeout(scan, 3000); // delay to let auth settle
    return () => clearTimeout(timeout);
  }, [scan]);

  return { scan };
}
