-- Cancelación de suscripción iniciada por el usuario
-- NO cambia status ni plan_id — evita disparar sync_plan_from_subscription
-- El cron expire_subscriptions degrada a free cuando vence current_period_end
CREATE OR REPLACE FUNCTION cancel_subscription(
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
  SET    cancelled_at         = NOW(),
         cancellation_reason  = p_reason,
         updated_at           = NOW()
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

  -- Audit log con IP y User-Agent
  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id,
    ip_address, user_agent, details, retain_until
  ) VALUES (
    p_user_id,
    'SUBSCRIPTION_CANCELLATION_REQUESTED',
    'subscription',
    v_sub_id,
    p_ip,
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

REVOKE ALL ON FUNCTION cancel_subscription(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_subscription(UUID, TEXT, TEXT, TEXT) TO service_role;
