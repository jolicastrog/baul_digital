-- =============================================================
-- 043: Auditoría de registros no confirmados
--
-- Captura automáticamente:
--   · Cada intento de registro nuevo (trigger INSERT en auth.users)
--   · Cuando el usuario confirma su correo (trigger UPDATE)
--   · Qué cuentas fueron limpiadas por pg_cron
--     (cleanup_unconfirmed_users archiva antes de borrar)
--
-- Columna reminder_sent_at reservada para la futura campaña de
-- reactivación por correo (pendiente ~15 días).
-- =============================================================


-- ── 1. Tabla ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unconfirmed_registrations_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT        NOT NULL,
  -- Sin FK hacia auth.users: debe sobrevivir a la eliminación del usuario
  auth_user_id     UUID,
  registered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at     TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'confirmed', 'cleaned'))
);

CREATE INDEX IF NOT EXISTS idx_unreg_log_email      ON public.unconfirmed_registrations_log (email);
CREATE INDEX IF NOT EXISTS idx_unreg_log_status     ON public.unconfirmed_registrations_log (status);
CREATE INDEX IF NOT EXISTS idx_unreg_log_auth_user  ON public.unconfirmed_registrations_log (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_unreg_log_registered ON public.unconfirmed_registrations_log (registered_at DESC);

-- Solo service_role puede acceder (bypasea RLS automáticamente)
ALTER TABLE public.unconfirmed_registrations_log ENABLE ROW LEVEL SECURITY;


-- ── 2. Trigger INSERT: capturar nuevo intento de registro ─────
CREATE OR REPLACE FUNCTION public.log_unconfirmed_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo si el email no viene ya confirmado (ej. OAuth social login)
  IF NEW.email_confirmed_at IS NULL THEN
    INSERT INTO public.unconfirmed_registrations_log (
      email, auth_user_id, registered_at, status
    ) VALUES (
      NEW.email, NEW.id, COALESCE(NEW.created_at, NOW()), 'pending'
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_unconfirmed_registration() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_log_unconfirmed_registration ON auth.users;
CREATE TRIGGER trg_log_unconfirmed_registration
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.log_unconfirmed_registration();


-- ── 3. Trigger UPDATE: marcar confirmado cuando confirman ─────
CREATE OR REPLACE FUNCTION public.log_email_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo cuando email_confirmed_at pasa de NULL a un valor
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.unconfirmed_registrations_log
    SET  confirmed_at = NEW.email_confirmed_at,
         status       = 'confirmed'
    WHERE auth_user_id = NEW.id
      AND status       = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_email_confirmation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_log_email_confirmation ON auth.users;
CREATE TRIGGER trg_log_email_confirmation
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.log_email_confirmation();


-- ── 4. Actualizar cleanup para archivar ANTES de borrar ───────
CREATE OR REPLACE FUNCTION public.cleanup_unconfirmed_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Marcar como 'cleaned' en el log antes de que desaparezcan de auth.users
  UPDATE public.unconfirmed_registrations_log
  SET  deleted_at = NOW(),
       status     = 'cleaned'
  WHERE auth_user_id IN (
    SELECT id FROM auth.users
    WHERE  email_confirmed_at IS NULL
      AND  created_at < NOW() - INTERVAL '24 hours'
  )
  AND status = 'pending';

  -- Eliminar (CASCADE limpia profiles, categories, documents, etc.)
  DELETE FROM auth.users
  WHERE  email_confirmed_at IS NULL
    AND  created_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

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

REVOKE ALL ON FUNCTION public.cleanup_unconfirmed_users() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_unconfirmed_users() TO service_role;
