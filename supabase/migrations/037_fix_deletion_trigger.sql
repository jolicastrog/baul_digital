-- =============================================================
-- FIX 037: Correcciones al flujo de eliminación de cuentas
--
-- Problema 1: archive_deleted_user() bloqueaba toda eliminación
--   → El trigger nunca debe lanzar excepción. Ahora envuelve
--     el INSERT en un bloque EXCEPTION para que cualquier fallo
--     sea silencioso y la eliminación continúe siempre.
--
-- Problema 2: RLS podía bloquear el INSERT en deleted_users_archive
--   → Se agrega SET row_security = off explícito.
--
-- Problema 3: execute_account_deletion() hacía DELETE FROM auth.users
--   → El service_role no tiene ese permiso vía SQL. La función
--     ahora solo marca el request como ejecutado; la eliminación
--     real en auth.users la realiza el API route vía
--     supabaseAdmin.auth.admin.deleteUser() (Supabase Admin SDK).
--
-- Problema 4: el trigger buscaba account_deletion_requests con
--   executed_at IS NOT NULL — cuando se borra desde la consola
--   de Supabase no hay registro previo, dando RECORD vacío.
--   Ahora busca cualquier registro activo o histórico.
-- =============================================================


-- ── 1. Reconstruir archive_deleted_user() ────────────────────
CREATE OR REPLACE FUNCTION archive_deleted_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off          -- bypass RLS explícito
AS $$
DECLARE
  v_doc_count    INT;
  v_reason       TEXT;
  v_req_ip       TEXT;
  v_req_ua       TEXT;
  v_requested_at TIMESTAMPTZ;
BEGIN
  -- Bloque interno: si falla el archivo, la eliminación NO se bloquea
  BEGIN
    SELECT COUNT(*) INTO v_doc_count
    FROM   documents
    WHERE  user_id = OLD.id;

    -- Buscar cualquier solicitud de baja (ejecutada o pendiente)
    SELECT reason, request_ip, request_ua, requested_at
    INTO   v_reason, v_req_ip, v_req_ua, v_requested_at
    FROM   account_deletion_requests
    WHERE  user_id = OLD.id
    ORDER BY COALESCE(executed_at, requested_at) DESC
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
      COALESCE(OLD.email, 'desconocido'),   -- NOT NULL — nunca debe ser null
      OLD.full_name,
      OLD.cedula_unica,
      OLD.cedula_tipo,
      OLD.plan_type,
      COALESCE(v_doc_count, 0),
      OLD.storage_used_bytes,
      v_reason,
      v_req_ip,
      v_req_ua,
      v_requested_at
    );

  EXCEPTION WHEN OTHERS THEN
    -- El archivo falló (RLS, constraint, etc.) pero la eliminación continúa.
    -- En producción se puede loguear aquí si se necesita diagnóstico.
    NULL;
  END;

  RETURN OLD;
END;
$$;


-- ── 2. Reconstruir execute_account_deletion() ────────────────
-- Ya NO hace DELETE FROM auth.users. Solo:
--   a) Verifica que existe solicitud pendiente
--   b) Marca executed_at en account_deletion_requests
--   c) Inserta audit_log
-- El API route (cron/execute-deletions) llama a
-- supabaseAdmin.auth.admin.deleteUser() después de este RPC.
CREATE OR REPLACE FUNCTION execute_account_deletion(
  p_user_id     UUID,
  p_executed_by TEXT DEFAULT 'cron'
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

  -- Marcar como ejecutada antes de que el trigger convierta user_id en NULL
  UPDATE account_deletion_requests
  SET    executed_at  = NOW(),
         executed_by  = p_executed_by
  WHERE  id = v_request_id;

  -- Limpiar flag en profiles (por si acaso llega aquí sin haberse limpiado)
  UPDATE profiles
  SET    deletion_requested_at = NULL,
         updated_at            = NOW()
  WHERE  id = p_user_id;

  -- Audit log
  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id,
    details, retain_until
  ) VALUES (
    p_user_id,
    'ACCOUNT_DELETION_PREPARED',
    'profile',
    p_user_id,
    jsonb_build_object('executed_by', p_executed_by),
    NOW() + INTERVAL '5 years'
  );

  -- IMPORTANTE: el llamador (API route) debe invocar
  -- supabaseAdmin.auth.admin.deleteUser(p_user_id) después de este RPC.
  RETURN jsonb_build_object(
    'success',  true,
    'user_id',  p_user_id,
    'request_id', v_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION execute_account_deletion(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION execute_account_deletion(UUID, TEXT) TO service_role;
