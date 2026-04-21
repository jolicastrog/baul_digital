-- =============================================================
-- 041: Limpieza automática de usuarios no confirmados (pg_cron)
--
-- Problema: usuarios que se registran pero nunca confirman su
--   correo dejan perfiles huérfanos en auth.users y profiles.
--
-- Solución: función que elimina de auth.users los registros con
--   email_confirmed_at IS NULL y más de 24h de antigüedad.
--   El CASCADE limpia automáticamente profiles, categories, etc.
--   Programada diariamente a las 2:30am UTC con pg_cron.
-- =============================================================

-- ── 1. Función de limpieza ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_unconfirmed_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM auth.users
  WHERE  email_confirmed_at IS NULL
    AND  created_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Registrar en audit_logs si hubo eliminaciones
  IF v_deleted > 0 THEN
    INSERT INTO public.audit_logs (
      user_id, action, resource_type, resource_id,
      details, retain_until
    ) VALUES (
      NULL,
      'UNCONFIRMED_USERS_CLEANUP',
      'system',
      NULL,
      jsonb_build_object('deleted_count', v_deleted, 'ran_at', NOW()),
      NOW() + INTERVAL '1 year'
    );
  END IF;

  RETURN v_deleted;
END;
$$;

-- Solo el sistema puede ejecutarla
REVOKE ALL ON FUNCTION public.cleanup_unconfirmed_users() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_unconfirmed_users() TO service_role;


-- ── 2. Programar con pg_cron (diario 2:30am UTC) ─────────────
-- Eliminar job anterior si existe (para poder re-ejecutar la migración)
SELECT cron.unschedule('cleanup-unconfirmed-users')
WHERE  EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-unconfirmed-users'
);

SELECT cron.schedule(
  'cleanup-unconfirmed-users',
  '30 2 * * *',
  $$ SELECT public.cleanup_unconfirmed_users() $$
);
