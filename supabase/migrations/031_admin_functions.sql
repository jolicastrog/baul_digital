-- ============================================================================
-- MIGRACIÓN 031: Funciones SECURITY DEFINER para el panel de administración
--
-- Objetivo:
--   Exponer operaciones privilegiadas (leer todos los usuarios, suspender,
--   ver pagos globales, etc.) a través de funciones que solo service_role
--   puede ejecutar. Ningún usuario autenticado puede llamarlas directamente.
--
-- Funciones creadas:
--   1. admin_get_stats()                         → métricas globales del sistema
--   2. admin_get_users(search, limit, offset)    → lista paginada de usuarios
--   3. admin_get_user_detail(user_id)            → detalle completo de un usuario
--   4. admin_toggle_user_active(user_id, active) → suspender/reactivar usuario
--   5. admin_set_admin_flag(user_id, is_admin)   → promover/revocar rol admin
--   6. admin_get_payments(limit, offset, status) → lista paginada de pagos
--   7. admin_get_audit_logs(limit, offset, ...)  → logs de auditoría paginados
--   8. admin_get_fraud_alerts(limit, offset)     → alertas de fraude activas
--
-- Seguridad:
--   - SECURITY DEFINER: ejecutan con privilegios del owner (postgres/service_role)
--   - REVOKE EXECUTE FROM PUBLIC, anon, authenticated en TODAS las funciones
--   - GRANT EXECUTE TO service_role (las API routes usan supabaseAdmin)
-- ============================================================================


-- ── 1. admin_get_stats() ──────────────────────────────────────────────────────
-- Retorna métricas globales para el dashboard del admin.
CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'total_users',          (SELECT COUNT(*) FROM public.profiles),
    'active_users',         (SELECT COUNT(*) FROM public.profiles WHERE is_active = TRUE),
    'suspended_users',      (SELECT COUNT(*) FROM public.profiles WHERE is_active = FALSE),
    'admin_users',          (SELECT COUNT(*) FROM public.profiles WHERE is_admin = TRUE),
    'total_documents',      (SELECT COUNT(*) FROM public.documents),
    'total_storage_bytes',  (SELECT COALESCE(SUM(storage_used_bytes), 0) FROM public.profiles),
    'new_users_today',      (SELECT COUNT(*) FROM public.profiles WHERE created_at >= CURRENT_DATE),
    'new_users_month',      (SELECT COUNT(*) FROM public.profiles WHERE created_at >= date_trunc('month', NOW())),
    'subscriptions_by_plan',(
      SELECT jsonb_object_agg(plan_type, cnt)
      FROM (SELECT plan_type, COUNT(*) AS cnt FROM public.profiles GROUP BY plan_type) s
    ),
    'revenue_month_cop',    (
      SELECT COALESCE(SUM(amount_cop), 0) FROM public.payment_orders
      WHERE status = 'approved' AND created_at >= date_trunc('month', NOW())
    ),
    'revenue_total_cop',    (
      SELECT COALESCE(SUM(amount_cop), 0) FROM public.payment_orders WHERE status = 'approved'
    ),
    'recent_payments',      (
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


-- ── 2. admin_get_users(search, limit, offset) ─────────────────────────────────
-- Lista paginada de usuarios con info de plan y estado.
-- p_search busca en email, full_name y cedula_unica (case-insensitive).
CREATE OR REPLACE FUNCTION public.admin_get_users(
  p_search TEXT    DEFAULT NULL,
  p_limit  INT     DEFAULT 20,
  p_offset INT     DEFAULT 0
)
RETURNS TABLE(
  id            UUID,
  email         TEXT,
  full_name     TEXT,
  nombres       TEXT,
  apellidos     TEXT,
  cedula_unica  TEXT,
  cedula_tipo   TEXT,
  plan_type     TEXT,
  is_active     BOOLEAN,
  is_admin      BOOLEAN,
  storage_used  BIGINT,
  storage_quota BIGINT,
  doc_count     BIGINT,
  created_at    TIMESTAMPTZ,
  total_count   BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.nombres,
    p.apellidos,
    p.cedula_unica,
    p.cedula_tipo,
    p.plan_type,
    p.is_active,
    p.is_admin,
    p.storage_used_bytes,
    p.storage_quota_bytes,
    (SELECT COUNT(*) FROM public.documents d WHERE d.user_id = p.id),
    p.created_at,
    COUNT(*) OVER() AS total_count
  FROM public.profiles p
  WHERE
    p_search IS NULL
    OR p.email      ILIKE '%' || p_search || '%'
    OR p.full_name  ILIKE '%' || p_search || '%'
    OR p.cedula_unica ILIKE '%' || p_search || '%'
  ORDER BY p.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_users(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_get_users(TEXT, INT, INT) TO service_role;


-- ── 3. admin_get_user_detail(user_id) ────────────────────────────────────────
-- Detalle completo de un usuario: perfil + suscripción activa + últimos pagos.
CREATE OR REPLACE FUNCTION public.admin_get_user_detail(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile      JSONB;
  v_subscription JSONB;
  v_payments     JSONB;
BEGIN
  v_profile      := (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = p_user_id);
  v_subscription := (SELECT to_jsonb(s) FROM public.subscriptions s
                     WHERE s.user_id = p_user_id AND s.status = 'active'
                     ORDER BY s.created_at DESC LIMIT 1);
  v_payments     := (SELECT jsonb_agg(row_to_json(po))
                     FROM (
                       SELECT id, amount_cop, billing_cycle, status, created_at, failure_reason
                       FROM public.payment_orders
                       WHERE user_id = p_user_id
                       ORDER BY created_at DESC
                       LIMIT 10
                     ) po);

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'profile',         v_profile,
    'subscription',    v_subscription,
    'recent_payments', v_payments,
    'doc_count',       (SELECT COUNT(*) FROM public.documents  WHERE user_id = p_user_id),
    'category_count',  (SELECT COUNT(*) FROM public.categories WHERE user_id = p_user_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_user_detail(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_get_user_detail(UUID) TO service_role;


-- ── 4. admin_toggle_user_active(user_id, active) ─────────────────────────────
-- Suspende (FALSE) o reactiva (TRUE) un usuario.
-- No permite que un admin se suspenda a sí mismo (protección básica).
CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(
  p_user_id UUID,
  p_active  BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    is_active  = p_active,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', p_user_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_toggle_user_active(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_toggle_user_active(UUID, BOOLEAN) TO service_role;


-- ── 5. admin_set_admin_flag(user_id, is_admin) ────────────────────────────────
-- Promueve o revoca el rol de administrador de un usuario.
CREATE OR REPLACE FUNCTION public.admin_set_admin_flag(
  p_user_id  UUID,
  p_is_admin BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    is_admin   = p_is_admin,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', p_user_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_admin_flag(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_set_admin_flag(UUID, BOOLEAN) TO service_role;


-- ── 6. admin_get_payments(limit, offset, status) ─────────────────────────────
-- Lista paginada de órdenes de pago con datos del usuario.
-- p_status NULL → todos los estados.
CREATE OR REPLACE FUNCTION public.admin_get_payments(
  p_limit  INT  DEFAULT 20,
  p_offset INT  DEFAULT 0,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE(
  id                  UUID,
  user_email          TEXT,
  user_full_name      TEXT,
  amount_cop          NUMERIC,
  billing_cycle       TEXT,
  status              TEXT,
  payment_method_type TEXT,
  failure_reason      TEXT,
  mp_payment_id       TEXT,
  created_at          TIMESTAMPTZ,
  processed_at        TIMESTAMPTZ,
  total_count         BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    po.id,
    p.email,
    p.full_name,
    po.amount_cop,
    po.billing_cycle,
    po.status,
    po.payment_method_type,
    po.failure_reason,
    po.mp_payment_id,
    po.created_at,
    po.processed_at,
    COUNT(*) OVER() AS total_count
  FROM public.payment_orders po
  LEFT JOIN public.profiles p ON p.id = po.user_id
  WHERE p_status IS NULL OR po.status = p_status
  ORDER BY po.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_payments(INT, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_get_payments(INT, INT, TEXT) TO service_role;


-- ── 7. admin_get_audit_logs(limit, offset, user_id, resource_type) ───────────
-- Logs de auditoría paginados con filtros opcionales.
CREATE OR REPLACE FUNCTION public.admin_get_audit_logs(
  p_limit         INT  DEFAULT 50,
  p_offset        INT  DEFAULT 0,
  p_user_id       UUID DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_action        TEXT DEFAULT NULL
)
RETURNS TABLE(
  id            UUID,
  user_email    TEXT,
  user_full_name TEXT,
  action        TEXT,
  resource_type TEXT,
  resource_id   UUID,
  details       JSONB,
  ip_address    INET,
  created_at    TIMESTAMPTZ,
  total_count   BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    p.email,
    p.full_name,
    al.action,
    al.resource_type,
    al.resource_id,
    al.details,
    al.ip_address,
    al.created_at,
    COUNT(*) OVER() AS total_count
  FROM public.audit_logs al
  LEFT JOIN public.profiles p ON p.id = al.user_id
  WHERE
    (p_user_id       IS NULL OR al.user_id       = p_user_id)
    AND (p_resource_type IS NULL OR al.resource_type = p_resource_type)
    AND (p_action        IS NULL OR al.action        ILIKE '%' || p_action || '%')
  ORDER BY al.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_audit_logs(INT, INT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_get_audit_logs(INT, INT, UUID, TEXT, TEXT) TO service_role;


-- ── 8. admin_get_fraud_alerts(limit, offset) ─────────────────────────────────
-- Alertas de fraude activas (no revisadas).
CREATE OR REPLACE FUNCTION public.admin_get_fraud_alerts(
  p_limit       INT     DEFAULT 50,
  p_offset      INT     DEFAULT 0,
  p_only_active BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
  id            UUID,
  user_email    TEXT,
  user_full_name TEXT,
  alert_type    TEXT,
  severity      TEXT,
  details       JSONB,
  reviewed      BOOLEAN,
  created_at    TIMESTAMPTZ,
  total_count   BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fd.id,
    p.email,
    p.full_name,
    fd.alert_type,
    fd.severity,
    fd.details,
    fd.reviewed,
    fd.created_at,
    COUNT(*) OVER() AS total_count
  FROM public.fraud_detection fd
  LEFT JOIN public.profiles p ON p.id = fd.user_id
  WHERE
    (NOT p_only_active OR fd.reviewed = FALSE)
  ORDER BY
    CASE fd.severity
      WHEN 'critical' THEN 1
      WHEN 'high'     THEN 2
      WHEN 'medium'   THEN 3
      ELSE 4
    END,
    fd.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_fraud_alerts(INT, INT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_get_fraud_alerts(INT, INT, BOOLEAN) TO service_role;


-- ── 9. admin_mark_fraud_reviewed(alert_id) ───────────────────────────────────
-- Marca una alerta de fraude como revisada.
CREATE OR REPLACE FUNCTION public.admin_mark_fraud_reviewed(p_alert_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.fraud_detection
  SET reviewed = TRUE
  WHERE id = p_alert_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alerta no encontrada: %', p_alert_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_mark_fraud_reviewed(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_mark_fraud_reviewed(UUID) TO service_role;


-- ── 10. Verificación ──────────────────────────────────────────────────────────
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'admin_%'
ORDER BY routine_name;
