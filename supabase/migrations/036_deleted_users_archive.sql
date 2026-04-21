-- =============================================================
-- FASE 4: Archivo de usuarios eliminados + email_logs +
--         trigger BEFORE DELETE + funciones admin
-- =============================================================


-- ── 1. deleted_users_archive ──────────────────────────────────
-- Sin FK a ninguna tabla — inmune a toda cascada.
-- Retiene datos mínimos para cumplir Ley 1581 y Cód. Comercio.
CREATE TABLE IF NOT EXISTS deleted_users_archive (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id UUID        NOT NULL,
  email            TEXT        NOT NULL,
  full_name        TEXT,
  cedula_unica     TEXT,
  cedula_tipo      TEXT,
  plan_type        TEXT,
  doc_count        INT,
  storage_used     BIGINT,
  deletion_reason  TEXT,
  deletion_ip      TEXT,
  deletion_ua      TEXT,
  requested_at     TIMESTAMPTZ,
  executed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retain_until     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 years')
);

CREATE INDEX IF NOT EXISTS idx_dua_original_user_id
  ON deleted_users_archive (original_user_id);

CREATE INDEX IF NOT EXISTS idx_dua_retain_until
  ON deleted_users_archive (retain_until);

-- RLS: solo service_role
ALTER TABLE deleted_users_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON deleted_users_archive
  USING (false) WITH CHECK (false);


-- ── 2. email_logs ─────────────────────────────────────────────
-- Registro de correos enviados (notificaciones de baja, recordatorios, etc.)
CREATE TABLE IF NOT EXISTS email_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,                              -- NULL si el usuario ya fue eliminado
  recipient     TEXT        NOT NULL,
  template      TEXT        NOT NULL,              -- 'deletion_warning' | 'deletion_confirmed' | etc.
  subject       TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT        NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  error_message TEXT,
  metadata      JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id
  ON email_logs (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at
  ON email_logs (sent_at DESC);

-- RLS: solo service_role
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON email_logs
  USING (false) WITH CHECK (false);


-- ── 3. Trigger BEFORE DELETE en profiles ─────────────────────
-- Captura snapshot del usuario ANTES de que CASCADE destruya
-- los registros hijos (documents, categories, subscriptions…)
CREATE OR REPLACE FUNCTION archive_deleted_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_count      INT;
  v_deletion_req   RECORD;
BEGIN
  -- Conteo de documentos antes de que cascade los elimine
  SELECT COUNT(*) INTO v_doc_count
  FROM   documents
  WHERE  user_id = OLD.id;

  -- Datos de la solicitud de baja (si existe)
  SELECT reason, request_ip, request_ua, requested_at
  INTO   v_deletion_req
  FROM   account_deletion_requests
  WHERE  user_id     = OLD.id
    AND  executed_at IS NOT NULL
  ORDER BY executed_at DESC
  LIMIT  1;

  INSERT INTO deleted_users_archive (
    original_user_id,
    email,
    full_name,
    cedula_unica,
    cedula_tipo,
    plan_type,
    doc_count,
    storage_used,
    deletion_reason,
    deletion_ip,
    deletion_ua,
    requested_at
  ) VALUES (
    OLD.id,
    OLD.email,
    OLD.full_name,
    OLD.cedula_unica,
    OLD.cedula_tipo,
    OLD.plan_type,
    v_doc_count,
    OLD.storage_used_bytes,
    v_deletion_req.reason,
    v_deletion_req.request_ip,
    v_deletion_req.request_ua,
    v_deletion_req.requested_at
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_deleted_user ON profiles;
CREATE TRIGGER trg_archive_deleted_user
  BEFORE DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION archive_deleted_user();


-- ── 4. purge_expired_archives() ───────────────────────────────
-- Elimina registros del archivo cuyo retain_until ya venció.
-- Ejecutar anualmente vía cron (1 enero).
CREATE OR REPLACE FUNCTION purge_expired_archives()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM deleted_users_archive
  WHERE  retain_until < NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', v_deleted,
    'purged_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION purge_expired_archives() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION purge_expired_archives() TO service_role;


-- ── 5. execute_account_deletion(p_user_id, p_executed_by) ────
-- Ejecuta la eliminación real: marca el request, borra de auth,
-- luego DELETE profiles (el trigger archiva antes del cascade).
CREATE OR REPLACE FUNCTION execute_account_deletion(
  p_user_id     UUID,
  p_executed_by TEXT DEFAULT 'cron'   -- 'cron' | 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  -- Obtener solicitud pendiente
  SELECT id INTO v_request_id
  FROM   account_deletion_requests
  WHERE  user_id      = p_user_id
    AND  cancelled_at IS NULL
    AND  executed_at  IS NULL;

  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending_deletion');
  END IF;

  -- Marcar como ejecutada (user_id se vuelve NULL tras DELETE profiles)
  UPDATE account_deletion_requests
  SET    executed_at  = NOW(),
         executed_by  = p_executed_by
  WHERE  id = v_request_id;

  -- Audit log antes del borrado
  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id,
    details, retain_until
  ) VALUES (
    p_user_id,
    'ACCOUNT_DELETED',
    'profile',
    p_user_id,
    jsonb_build_object('executed_by', p_executed_by),
    NOW() + INTERVAL '5 years'
  );

  -- Eliminar de auth.users — dispara cascade a profiles → trigger archiva
  -- Nota: auth.users CASCADE → profiles CASCADE → documents, categories, etc.
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION execute_account_deletion(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION execute_account_deletion(UUID, TEXT) TO service_role;


-- ── 6. admin_get_deleted_users(search, limit, offset) ────────
CREATE OR REPLACE FUNCTION admin_get_deleted_users(
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 20,
  p_offset INT  DEFAULT 0
)
RETURNS TABLE(
  id               UUID,
  original_user_id UUID,
  email            TEXT,
  full_name        TEXT,
  plan_type        TEXT,
  doc_count        INT,
  deletion_reason  TEXT,
  requested_at     TIMESTAMPTZ,
  executed_at      TIMESTAMPTZ,
  retain_until     TIMESTAMPTZ,
  total_count      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dua.id,
    dua.original_user_id,
    dua.email,
    dua.full_name,
    dua.plan_type,
    dua.doc_count,
    dua.deletion_reason,
    dua.requested_at,
    dua.executed_at,
    dua.retain_until,
    COUNT(*) OVER() AS total_count
  FROM deleted_users_archive dua
  WHERE (
    p_search IS NULL
    OR dua.email     ILIKE '%' || p_search || '%'
    OR dua.full_name ILIKE '%' || p_search || '%'
  )
  ORDER BY dua.executed_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION admin_get_deleted_users(TEXT, INT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION admin_get_deleted_users(TEXT, INT, INT) TO service_role;


-- ── 7. admin_get_pending_deletions() ─────────────────────────
-- Lista solicitudes activas (pendientes de ejecutar o en periodo de gracia)
CREATE OR REPLACE FUNCTION admin_get_pending_deletions()
RETURNS TABLE(
  request_id    UUID,
  user_id       UUID,
  user_email    TEXT,
  requested_at  TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  days_remaining INT,
  reason        TEXT,
  request_ip    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    adr.id           AS request_id,
    adr.user_id,
    adr.user_email,
    adr.requested_at,
    adr.scheduled_for,
    GREATEST(0, EXTRACT(DAY FROM (adr.scheduled_for - NOW()))::INT) AS days_remaining,
    adr.reason,
    adr.request_ip
  FROM account_deletion_requests adr
  WHERE adr.cancelled_at IS NULL
    AND adr.executed_at  IS NULL
  ORDER BY adr.scheduled_for ASC;
END;
$$;

REVOKE ALL ON FUNCTION admin_get_pending_deletions() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION admin_get_pending_deletions() TO service_role;


-- ── 8. admin_cancel_user_deletion(p_request_id, p_admin_note)
CREATE OR REPLACE FUNCTION admin_cancel_user_deletion(
  p_request_id UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM   account_deletion_requests
  WHERE  id           = p_request_id
    AND  cancelled_at IS NULL
    AND  executed_at  IS NULL;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found_or_already_processed');
  END IF;

  UPDATE account_deletion_requests
  SET    cancelled_at = NOW(),
         cancelled_by = 'admin'
  WHERE  id = p_request_id;

  -- Limpiar flag en profiles
  UPDATE profiles
  SET    deletion_requested_at = NULL,
         updated_at            = NOW()
  WHERE  id = v_user_id;

  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id,
    details, retain_until
  ) VALUES (
    v_user_id,
    'ACCOUNT_DELETION_CANCELLED_BY_ADMIN',
    'profile',
    v_user_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'admin_note', p_admin_note
    ),
    NOW() + INTERVAL '5 years'
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION admin_cancel_user_deletion(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION admin_cancel_user_deletion(UUID, TEXT) TO service_role;


-- ── 9. Actualizar admin_get_stats() con métricas de bajas ─────
CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'total_users',           (SELECT COUNT(*) FROM public.profiles),
    'active_users',          (SELECT COUNT(*) FROM public.profiles WHERE is_active = TRUE),
    'suspended_users',       (SELECT COUNT(*) FROM public.profiles WHERE is_active = FALSE),
    'admin_users',           (SELECT COUNT(*) FROM public.profiles WHERE is_admin = TRUE),
    'pending_deletions',     (
      SELECT COUNT(*) FROM public.account_deletion_requests
      WHERE cancelled_at IS NULL AND executed_at IS NULL
    ),
    'total_deleted_users',   (SELECT COUNT(*) FROM public.deleted_users_archive),
    'total_documents',       (SELECT COUNT(*) FROM public.documents),
    'total_storage_bytes',   (SELECT COALESCE(SUM(storage_used_bytes), 0) FROM public.profiles),
    'new_users_today',       (SELECT COUNT(*) FROM public.profiles WHERE created_at >= CURRENT_DATE),
    'new_users_month',       (SELECT COUNT(*) FROM public.profiles WHERE created_at >= date_trunc('month', NOW())),
    'subscriptions_by_plan', (
      SELECT jsonb_object_agg(plan_type, cnt)
      FROM (SELECT plan_type, COUNT(*) AS cnt FROM public.profiles GROUP BY plan_type) s
    ),
    'revenue_month_cop',     (
      SELECT COALESCE(SUM(amount_cop), 0) FROM public.payment_orders
      WHERE status = 'approved' AND created_at >= date_trunc('month', NOW())
    ),
    'revenue_total_cop',     (
      SELECT COALESCE(SUM(amount_cop), 0) FROM public.payment_orders WHERE status = 'approved'
    ),
    'recent_payments',       (
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT po.id, po.amount_cop, po.billing_cycle, po.status, po.created_at,
               p.email, p.full_name
        FROM public.payment_orders po
        LEFT JOIN public.profiles p ON p.id = po.user_id
        WHERE po.status = 'approved'
        ORDER BY po.created_at DESC
        LIMIT 5
      ) r
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_stats() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_get_stats() TO service_role;
