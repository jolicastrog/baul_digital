-- =============================================================
-- FASE 3: Solicitud y gestión de cierre de cuenta
-- =============================================================

-- 1. Columna en profiles para detectar cuentas en periodo de gracia
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

-- 2. Tabla de solicitudes de cierre
--    user_id: SET NULL (no CASCADE) — el registro sobrevive al borrado como evidencia SIC
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  user_email      TEXT        NOT NULL,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_for   TIMESTAMPTZ NOT NULL,
  reason          TEXT,
  cancelled_at    TIMESTAMPTZ,
  cancelled_by    TEXT,           -- 'user' | 'admin'
  executed_at     TIMESTAMPTZ,
  executed_by     TEXT,           -- 'cron' | 'admin'
  request_ip      TEXT,
  request_ua      TEXT,
  CONSTRAINT uq_deletion_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_adr_scheduled_for
  ON account_deletion_requests (scheduled_for)
  WHERE cancelled_at IS NULL AND executed_at IS NULL;

-- RLS: solo service_role accede a esta tabla
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON account_deletion_requests
  USING (false) WITH CHECK (false);


-- =============================================================
-- 3. request_account_deletion
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
  v_email        TEXT;
  v_scheduled    TIMESTAMPTZ;
  v_sub_result   JSONB;
BEGIN
  -- Verificar que el perfil existe
  SELECT email INTO v_email
  FROM   profiles
  WHERE  id = p_user_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  -- Verificar que no haya solicitud activa ya
  IF EXISTS (
    SELECT 1 FROM account_deletion_requests
    WHERE  user_id = p_user_id
      AND  cancelled_at IS NULL
      AND  executed_at  IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'deletion_already_requested');
  END IF;

  v_scheduled := NOW() + INTERVAL '30 days';

  -- Si tiene suscripción activa, cancelarla en la misma transacción
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE  user_id = p_user_id AND status = 'active'
  ) THEN
    SELECT cancel_subscription(
      p_user_id,
      'Cuenta cerrada por el usuario',
      p_ip,
      p_ua
    ) INTO v_sub_result;
  END IF;

  -- Registrar solicitud de cierre
  INSERT INTO account_deletion_requests (
    user_id, user_email, scheduled_for, reason, request_ip, request_ua
  ) VALUES (
    p_user_id, v_email, v_scheduled, p_reason, p_ip, p_ua
  );

  -- Marcar perfil en periodo de gracia
  UPDATE profiles
  SET    deletion_requested_at = NOW(),
         updated_at            = NOW()
  WHERE  id = p_user_id;

  -- Audit log
  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id,
    ip_address, user_agent, details, retain_until
  ) VALUES (
    p_user_id,
    'ACCOUNT_DELETION_REQUESTED',
    'profile',
    p_user_id,
    p_ip,
    p_ua,
    jsonb_build_object(
      'reason',        p_reason,
      'scheduled_for', v_scheduled,
      'email',         v_email
    ),
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
GRANT EXECUTE ON FUNCTION request_account_deletion(UUID, TEXT, TEXT, TEXT) TO service_role;


-- =============================================================
-- 4. cancel_account_deletion
-- =============================================================
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
BEGIN
  -- Verificar que existe solicitud activa
  IF NOT EXISTS (
    SELECT 1 FROM account_deletion_requests
    WHERE  user_id = p_user_id
      AND  cancelled_at IS NULL
      AND  executed_at  IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending_deletion');
  END IF;

  UPDATE account_deletion_requests
  SET    cancelled_at = NOW(),
         cancelled_by = 'user'
  WHERE  user_id      = p_user_id
    AND  cancelled_at IS NULL
    AND  executed_at  IS NULL;

  UPDATE profiles
  SET    deletion_requested_at = NULL,
         updated_at            = NOW()
  WHERE  id = p_user_id;

  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id,
    ip_address, user_agent, details, retain_until
  ) VALUES (
    p_user_id,
    'ACCOUNT_DELETION_CANCELLED',
    'profile',
    p_user_id,
    p_ip,
    p_ua,
    jsonb_build_object('cancelled_by', 'user'),
    NOW() + INTERVAL '5 years'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION cancel_account_deletion(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_account_deletion(UUID, TEXT, TEXT) TO service_role;


-- =============================================================
-- 5. get_user_document_paths
-- =============================================================
CREATE OR REPLACE FUNCTION get_user_document_paths(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paths TEXT[];
BEGIN
  SELECT ARRAY_AGG(storage_path)
  INTO   v_paths
  FROM   documents
  WHERE  user_id = p_user_id;

  RETURN COALESCE(v_paths, '{}');
END;
$$;

REVOKE ALL ON FUNCTION get_user_document_paths(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_document_paths(UUID) TO service_role;


-- =============================================================
-- 6. get_pending_account_deletions
-- =============================================================
CREATE OR REPLACE FUNCTION get_pending_account_deletions()
RETURNS TABLE (
  user_id       UUID,
  user_email    TEXT,
  scheduled_for TIMESTAMPTZ,
  reason        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT adr.user_id,
         adr.user_email,
         adr.scheduled_for,
         adr.reason
  FROM   account_deletion_requests adr
  WHERE  adr.scheduled_for <= NOW()
    AND  adr.cancelled_at  IS NULL
    AND  adr.executed_at   IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION get_pending_account_deletions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_pending_account_deletions() TO service_role;
