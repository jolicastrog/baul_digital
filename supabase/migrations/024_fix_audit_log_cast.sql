-- ============================================================================
-- MIGRACIÓN 024: Corregir cast de resource_id en process_approved_payment
-- y process_failed_payment — audit_logs.resource_id es UUID, no TEXT.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_approved_payment(
  p_user_id          UUID,
  p_transaction_id   TEXT,
  p_gateway          TEXT,
  p_plan_type        TEXT,
  p_amount           NUMERIC,
  p_billing_cycle    TEXT,
  p_payload          JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan             RECORD;
  v_period_end       TIMESTAMPTZ;
  v_billing_db       TEXT;
  v_sub_id           UUID;
  v_old_status       TEXT;
  v_old_plan_code    TEXT;
  v_payment_order_id UUID;
  v_mp_preference    TEXT;
BEGIN
  SELECT id, code, storage_bytes INTO v_plan
  FROM public.plans WHERE code = p_plan_type;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'Plan no encontrado: %', p_plan_type;
  END IF;

  v_period_end := NOW() + CASE p_billing_cycle
    WHEN 'annual'     THEN INTERVAL '12 months'
    WHEN 'semiannual' THEN INTERVAL '6 months'
    ELSE                   INTERVAL '1 month'
  END;

  v_billing_db    := CASE WHEN p_billing_cycle = 'monthly' THEN 'monthly' ELSE 'yearly' END;
  v_mp_preference := p_payload->>'preference_id';

  SELECT s.id, s.status, p.code
  INTO v_sub_id, v_old_status, v_old_plan_code
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = p_user_id;

  INSERT INTO public.subscriptions (
    user_id, plan_id, plan_type, status, billing_cycle,
    current_period_start, current_period_end,
    storage_quota_bytes, is_active, updated_at
  ) VALUES (
    p_user_id, v_plan.id, v_plan.code, 'active', v_billing_db,
    NOW(), v_period_end,
    v_plan.storage_bytes, TRUE, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id              = EXCLUDED.plan_id,
    plan_type            = EXCLUDED.plan_type,
    status               = 'active',
    billing_cycle        = EXCLUDED.billing_cycle,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end   = EXCLUDED.current_period_end,
    storage_quota_bytes  = EXCLUDED.storage_quota_bytes,
    is_active            = TRUE,
    cancelled_at         = NULL,
    cancellation_reason  = NULL,
    updated_at           = NOW()
  RETURNING id INTO v_sub_id;

  INSERT INTO public.payment_orders (
    user_id, subscription_id, mp_payment_id, mp_preference_id,
    gateway, amount_cop, billing_cycle,
    period_start, period_end, status,
    payment_method_type, raw_payload, processed_at
  ) VALUES (
    p_user_id, v_sub_id, p_transaction_id, v_mp_preference,
    p_gateway, p_amount, p_billing_cycle,
    NOW(), v_period_end, 'approved',
    p_payload->>'payment_type_id', p_payload, NOW()
  )
  ON CONFLICT (mp_payment_id) DO NOTHING
  RETURNING id INTO v_payment_order_id;

  INSERT INTO public.subscription_events (
    subscription_id, payment_order_id, event_type,
    old_status, new_status, old_plan_code, new_plan_code,
    triggered_by
  ) VALUES (
    v_sub_id, v_payment_order_id,
    CASE
      WHEN v_old_status = 'active' AND v_old_plan_code = p_plan_type THEN 'renewed'
      WHEN v_old_plan_code IS DISTINCT FROM p_plan_type              THEN 'plan_changed'
      ELSE 'activated'
    END,
    v_old_status, 'active',
    v_old_plan_code, v_plan.code,
    'webhook'
  );

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

  -- CORREGIDO: v_sub_id es UUID, no necesita cast
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    p_user_id, 'PAYMENT_APPROVED', 'subscription', v_sub_id,
    jsonb_build_object(
      'mp_payment_id', p_transaction_id,
      'gateway',       p_gateway,
      'plan',          p_plan_type,
      'amount_cop',    p_amount,
      'billing_cycle', p_billing_cycle
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_failed_payment(
  p_user_id        UUID,
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
DECLARE
  v_sub_id UUID;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT id INTO v_sub_id FROM public.subscriptions WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.payment_orders (
    user_id, subscription_id, mp_payment_id,
    gateway, amount_cop, billing_cycle,
    status, raw_payload, processed_at
  ) VALUES (
    p_user_id, v_sub_id, p_transaction_id,
    p_gateway, p_amount, 'monthly',
    'rejected', p_payload, NOW()
  )
  ON CONFLICT (mp_payment_id) DO NOTHING;

  INSERT INTO public.payment_webhooks (
    user_id, transaction_id, payment_gateway,
    amount, currency, status, webhook_payload, processed_at
  ) VALUES (
    p_user_id, p_transaction_id, p_gateway,
    p_amount, 'COP', 'failed', p_payload, NOW()
  )
  ON CONFLICT (transaction_id) DO NOTHING;

  -- CORREGIDO: v_sub_id es UUID
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      p_user_id, 'PAYMENT_FAILED', 'subscription', v_sub_id,
      jsonb_build_object(
        'mp_payment_id', p_transaction_id,
        'gateway',       p_gateway,
        'amount_cop',    p_amount
      )
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_approved_payment TO service_role;
GRANT EXECUTE ON FUNCTION public.process_failed_payment   TO service_role;

SELECT 'Funciones corregidas correctamente' AS resultado;
