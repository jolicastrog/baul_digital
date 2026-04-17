-- ============================================================================
-- MIGRACIÓN 021: Funciones para procesar pagos de MercadoPago
--
-- process_approved_payment: actualiza profile, subscription, registra webhook
--                           y audit_log en una sola transacción.
-- process_failed_payment:   registra webhook fallido y audit_log.
-- ============================================================================

-- ============================================================================
-- FUNCIÓN: process_approved_payment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_approved_payment(
  p_user_id        UUID,
  p_transaction_id TEXT,
  p_gateway        TEXT,
  p_plan_type      TEXT,
  p_amount         NUMERIC,
  p_billing_cycle  TEXT,   -- 'monthly' | 'semiannual' | 'annual'
  p_payload        JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_storage_quota BIGINT;
  v_period_end    TIMESTAMPTZ;
  v_billing_db    TEXT;
BEGIN
  -- Cuota de almacenamiento según plan
  v_storage_quota := CASE p_plan_type
    WHEN 'enterprise' THEN 5368709120   -- 5 GB
    WHEN 'premium'    THEN 524288000    -- 500 MB
    ELSE                   20971520     -- 20 MB
  END;

  -- Fecha de fin del período
  v_period_end := NOW() + CASE p_billing_cycle
    WHEN 'annual'     THEN INTERVAL '12 months'
    WHEN 'semiannual' THEN INTERVAL '6 months'
    ELSE                   INTERVAL '1 month'
  END;

  -- billing_cycle para la tabla subscriptions solo admite 'monthly'|'yearly'
  v_billing_db := CASE WHEN p_billing_cycle = 'monthly' THEN 'monthly' ELSE 'yearly' END;

  -- 1. Registrar webhook
  INSERT INTO public.payment_webhooks (
    user_id, transaction_id, payment_gateway,
    amount, currency, status, plan_type,
    webhook_payload, processed_at
  ) VALUES (
    p_user_id, p_transaction_id, p_gateway,
    p_amount, 'COP', 'approved', p_plan_type,
    p_payload, NOW()
  )
  ON CONFLICT (transaction_id) DO NOTHING;

  -- 2. Actualizar plan en perfil
  UPDATE public.profiles
  SET
    plan_type           = p_plan_type,
    storage_quota_bytes = v_storage_quota,
    updated_at          = NOW()
  WHERE id = p_user_id;

  -- 3. Crear o actualizar suscripción
  INSERT INTO public.subscriptions (
    user_id, plan_type, storage_quota_bytes,
    billing_cycle, current_period_start, current_period_end,
    is_active, updated_at
  ) VALUES (
    p_user_id, p_plan_type, v_storage_quota,
    v_billing_db, NOW(), v_period_end,
    TRUE, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_type            = EXCLUDED.plan_type,
    storage_quota_bytes  = EXCLUDED.storage_quota_bytes,
    billing_cycle        = EXCLUDED.billing_cycle,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end   = EXCLUDED.current_period_end,
    is_active            = TRUE,
    cancelled_at         = NULL,
    cancellation_reason  = NULL,
    updated_at           = NOW();

  -- 4. Registrar en audit_log
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    p_user_id,
    'PAYMENT_APPROVED',
    'subscription',
    p_user_id::TEXT,
    jsonb_build_object(
      'transaction_id', p_transaction_id,
      'gateway',        p_gateway,
      'plan_type',      p_plan_type,
      'amount',         p_amount,
      'billing_cycle',  p_billing_cycle
    )
  );
END;
$$;

-- ============================================================================
-- FUNCIÓN: process_failed_payment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_failed_payment(
  p_user_id        UUID,       -- puede ser NULL si no se identificó el usuario
  p_transaction_id TEXT,
  p_gateway        TEXT,
  p_amount         NUMERIC,
  p_payload        JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Registrar webhook fallido
  INSERT INTO public.payment_webhooks (
    user_id, transaction_id, payment_gateway,
    amount, currency, status,
    webhook_payload, processed_at
  ) VALUES (
    p_user_id, p_transaction_id, p_gateway,
    p_amount, 'COP', 'failed',
    p_payload, NOW()
  )
  ON CONFLICT (transaction_id) DO NOTHING;

  -- 2. Audit log (solo si conocemos el usuario)
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      p_user_id,
      'PAYMENT_FAILED',
      'subscription',
      p_user_id::TEXT,
      jsonb_build_object(
        'transaction_id', p_transaction_id,
        'gateway',        p_gateway,
        'amount',         p_amount
      )
    );
  END IF;
END;
$$;

-- Permisos: solo service_role puede ejecutar estas funciones
REVOKE EXECUTE ON FUNCTION public.process_approved_payment FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_failed_payment   FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.process_approved_payment TO service_role;
GRANT  EXECUTE ON FUNCTION public.process_failed_payment   TO service_role;

-- Verificación
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('process_approved_payment', 'process_failed_payment')
  AND pronamespace = 'public'::regnamespace;
