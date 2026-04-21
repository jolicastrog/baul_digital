-- =============================================================
-- FIX 040: cast TEXT → INET en audit_logs.ip_address
--
-- Problema: request_account_deletion() y cancel_account_deletion()
--   insertan p_ip (TEXT) en audit_logs.ip_address (INET),
--   causando error 42804 de incompatibilidad de tipos.
--
-- Solución: reconstruir ambas funciones con cast explícito
--   NULLIF(p_ip,'')::INET para que texto vacío → NULL y texto
--   con IP válida → inet correctamente.
-- =============================================================

CREATE OR REPLACE FUNCTION request_account_deletion(
  p_user_id UUID,
  p_reason  TEXT    DEFAULT NULL,
  p_ip      TEXT    DEFAULT NULL,
  p_ua      TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email     TEXT;
  v_scheduled TIMESTAMPTZ;
BEGIN
  -- Verificar que no haya solicitud activa
  IF EXISTS (
    SELECT 1 FROM account_deletion_requests
    WHERE  user_id      = p_user_id
      AND  cancelled_at IS NULL
      AND  executed_at  IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'deletion_already_requested');
  END IF;

  SELECT email INTO v_email FROM profiles WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  v_scheduled := NOW() + INTERVAL '30 days';

  -- Marcar en profiles
  UPDATE profiles
  SET    deletion_requested_at = NOW(),
         updated_at            = NOW()
  WHERE  id = p_user_id;

  -- Registrar solicitud
  INSERT INTO account_deletion_requests (
    user_id, user_email, scheduled_for, reason, request_ip, request_ua
  ) VALUES (
    p_user_id, v_email, v_scheduled, p_reason, p_ip, p_ua
  );

  -- Audit log con cast seguro TEXT → INET
  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id,
    ip_address, user_agent, details, retain_until
  ) VALUES (
    p_user_id,
    'ACCOUNT_DELETION_REQUESTED',
    'profile',
    p_user_id,
    NULLIF(p_ip, '')::INET,
    p_ua,
    jsonb_build_object('scheduled_for', v_scheduled, 'reason', p_reason),
    NOW() + INTERVAL '5 years'
  );

  RETURN jsonb_build_object(
    'success',        true,
    'scheduled_for',  v_scheduled,
    'days_remaining', 30
  );
END;
$$;

REVOKE ALL ON FUNCTION request_account_deletion(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION request_account_deletion(UUID, TEXT, TEXT, TEXT) TO service_role;


CREATE OR REPLACE FUNCTION cancel_account_deletion(
  p_user_id UUID,
  p_ip      TEXT DEFAULT NULL,
  p_ua      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  SELECT id INTO v_request_id
  FROM   account_deletion_requests
  WHERE  user_id      = p_user_id
    AND  cancelled_at IS NULL
    AND  executed_at  IS NULL;

  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending_deletion');
  END IF;

  UPDATE account_deletion_requests
  SET    cancelled_at = NOW()
  WHERE  id = v_request_id;

  UPDATE profiles
  SET    deletion_requested_at = NULL,
         updated_at            = NOW()
  WHERE  id = p_user_id;

  -- Audit log con cast seguro TEXT → INET
  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id,
    ip_address, user_agent, details, retain_until
  ) VALUES (
    p_user_id,
    'ACCOUNT_DELETION_CANCELLED',
    'profile',
    p_user_id,
    NULLIF(p_ip, '')::INET,
    p_ua,
    jsonb_build_object('request_id', v_request_id),
    NOW() + INTERVAL '5 years'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION cancel_account_deletion(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION cancel_account_deletion(UUID, TEXT, TEXT) TO service_role;
