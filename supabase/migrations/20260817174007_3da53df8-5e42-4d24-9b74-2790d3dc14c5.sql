-- Resumo comercial para Dashboard e Assistente Comercial
CREATE OR REPLACE FUNCTION public.get_commercial_summary(
    p_company_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_is_admin BOOLEAN;
    v_is_gestor BOOLEAN;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    -- Identificar usuário e empresa se não fornecidos
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Buscar perfil do usuário para permissões e company_id
    SELECT 
        company_id,
        (SELECT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = v_user_id AND ur.role = 'admin')),
        (SELECT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = v_user_id AND ur.role = 'gestor'))
    INTO v_company_id, v_is_admin, v_is_gestor
    FROM profiles
    WHERE id = v_user_id;

    -- Usar company_id fornecido se disponível e usuário for admin/gestor, senão usar o do perfil
    IF p_company_id IS NOT NULL AND (v_is_admin OR v_is_gestor) THEN
        v_company_id := p_company_id;
    END IF;

    -- Período (padrão: mês atual se não fornecido)
    v_start_date := COALESCE(p_start_date, date_trunc('month', now()));
    v_end_date := COALESCE(p_end_date, now());

    -- Agregação de métricas
    WITH quote_metrics AS (
        SELECT 
            COUNT(*) as total_quotes,
            COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
            COUNT(*) FILTER (WHERE status IN ('negotiation', 'negociacao', 'sent', 'draft', 'pre_venda', 'pre_sale', 'contato_feito', 'contact_made')) as pending_count,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
            COALESCE(SUM(COALESCE(total_amount, total, 0)) FILTER (WHERE status = 'approved'), 0) as approved_revenue,
            COALESCE(SUM(COALESCE(total_amount, total, 0)) FILTER (WHERE status IN ('negotiation', 'negociacao', 'sent')), 0) as forecast_revenue
        FROM quotes
        WHERE 
            (v_company_id IS NULL OR company_id = v_company_id)
            AND (
                (v_is_admin OR v_is_gestor) -- Admins/Gestores veem tudo da empresa
                OR created_by = v_user_id     -- Vendedores veem apenas os seus
            )
            AND created_at >= v_start_date
            AND created_at <= v_end_date
    ),
    client_metrics AS (
        SELECT COUNT(*) as total_clients
        FROM clients
        WHERE 
            (v_company_id IS NULL OR company_id = v_company_id)
            AND (
                (v_is_admin OR v_is_gestor)
                OR created_by = v_user_id
            )
    ),
    product_metrics AS (
        SELECT COUNT(*) as total_products
        FROM products
        WHERE (v_company_id IS NULL OR company_id = v_company_id)
    ),
    task_metrics AS (
        SELECT COUNT(*) as overdue_tasks
        FROM tasks
        WHERE 
            (v_company_id IS NULL OR company_id = v_company_id)
            AND (
                (v_is_admin OR v_is_gestor)
                OR created_by = v_user_id
            )
            AND due_date < now()
            AND status != 'done'
    ),
    demo_metrics AS (
        SELECT COUNT(*) as demo_expiring
        FROM quotes
        WHERE 
            (v_company_id IS NULL OR company_id = v_company_id)
            AND (
                (v_is_admin OR v_is_gestor)
                OR created_by = v_user_id
            )
            AND is_demonstration = true
            AND demonstration_end_date IS NOT NULL
            AND demonstration_end_date <= (now() + interval '7 days')
            AND demonstration_end_date >= now()
    ),
    inactive_clients AS (
        SELECT COUNT(*) as inactive_count
        FROM clients
        WHERE 
            (v_company_id IS NULL OR company_id = v_company_id)
            AND (
                (v_is_admin OR v_is_gestor)
                OR created_by = v_user_id
            )
            AND (last_purchase_date < (now() - interval '180 days') OR last_purchase_date IS NULL)
    )
    SELECT jsonb_build_object(
        'quotes', (SELECT total_quotes FROM quote_metrics),
        'approved_count', (SELECT approved_count FROM quote_metrics),
        'pending_count', (SELECT pending_count FROM quote_metrics),
        'rejected_count', (SELECT rejected_count FROM quote_metrics),
        'approved_revenue', (SELECT approved_revenue FROM quote_metrics),
        'forecast_revenue', (SELECT forecast_revenue FROM quote_metrics),
        'avg_ticket', CASE 
            WHEN (SELECT approved_count FROM quote_metrics) > 0 
            THEN (SELECT approved_revenue FROM quote_metrics) / (SELECT approved_count FROM quote_metrics)
            ELSE 0 
        END,
        'clients_count', (SELECT total_clients FROM client_metrics),
        'products_count', (SELECT total_products FROM product_metrics),
        'overdue_tasks', (SELECT overdue_tasks FROM task_metrics),
        'demo_expiring', (SELECT demo_expiring FROM demo_metrics),
        'inactive_clients', (SELECT inactive_count FROM inactive_clients),
        'conversion_rate', CASE 
            WHEN (SELECT total_quotes FROM quote_metrics) > 0 
            THEN ROUND(((SELECT approved_count FROM quote_metrics)::NUMERIC / (SELECT total_quotes FROM quote_metrics)::NUMERIC) * 100, 2)
            ELSE 0 
        END
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_commercial_summary(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_commercial_summary(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
