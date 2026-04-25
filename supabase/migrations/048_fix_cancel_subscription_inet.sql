-- ============================================================================
-- 048: Corregir cancel_subscription — cast TEXT → inet para ip_address
--
-- audit_logs.ip_address es tipo inet, pero p_ip llega como TEXT.
-- Además se corrige el INSERT a subscription_events (columna details JSONB
-- ya agregada en migración 047).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_user_id    UUID,
  p_reason     TEXT,
  p_ip         TEXT DEFAULT NULL,
  p_ua         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id      UUID;
  v_period_end  TIMESTAMPTZ;
  v_plan_type   TEXT;
BEGIN
  -- Verificar suscripción activa para este usuario
  SELECT id, current_period_end, plan_type
  INTO   v_sub_id, v_period_end, v_plan_type
  FROM   subscriptions
  WHERE  user_id = p_user_id
    AND  status  = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'no_active_subscription',
      'message', 'No se encontró una suscripción activa para cancelar.'
    );
  END IF;

  -- Marcar cancelación sin tocar status ni plan_id
  UPDATE subscriptions
  SET    cancelled_at        = NOW(),
         cancellation_reason = p_reason,
         updated_at          = NOW()
  WHERE  id = v_sub_id;

  -- Evento en historial de suscripción
  INSERT INTO subscription_events (
    subscription_id, event_type, triggered_by, details
  ) VALUES (
    v_sub_id,
    'cancellation_requested',
    'user',
    jsonb_build_object(
      'reason',     p_reason,
      'period_end', v_period_end,
      'plan_type',  v_plan_type
    )
  );

  -- Audit log — NULLIF convierte cadena vacía en NULL antes del cast a inet
  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id,
    ip_address, user_agent, details, retain_until
  ) VALUES (
    p_user_id,
    'SUBSCRIPTION_CANCELLATION_REQUESTED',
    'subscription',
    v_sub_id,
    NULLIF(p_ip, '')::inet,   -- cast seguro TEXT → inet
    p_ua,
    jsonb_build_object(
      'reason',     p_reason,
      'plan_type',  v_plan_type,
      'period_end', v_period_end
    ),
    NOW() + INTERVAL '5 years'
  );

  RETURN jsonb_build_object(
    'success',    true,
    'period_end', v_period_end,
    'plan_type',  v_plan_type,
    'message',    'Suscripción cancelada. Tu plan seguirá activo hasta el vencimiento del período.'
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.cancel_subscription(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(UUID, TEXT, TEXT, TEXT) TO service_role;

SELECT 'Migración 048 aplicada correctamente' AS resultado;
