-- ============================================================================
-- MIGRACIÓN 028: Corrección de seguridad multi-tenant
--
-- Problemas que resuelve:
--
--   1. Funciones de migration 001 sin REVOKE: check_storage_quota,
--      update_storage_used y free_storage quedaron con EXECUTE PUBLIC,
--      permitiendo que cualquier usuario autenticado las llame via
--      /rest/v1/rpc/ con el user_id de otro usuario.
--
--   2. fraud_detection RLS usaba plan_type = 'enterprise' como proxy de
--      admin — cualquier usuario enterprise podía ver datos de fraude de
--      todos los usuarios. Se reemplaza por columna is_admin dedicada.
-- ============================================================================


-- ── 1. Securizar funciones de storage (migration 001) ────────────────────────

REVOKE EXECUTE ON FUNCTION public.check_storage_quota(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_storage_quota(UUID, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_storage_used(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_storage_used(UUID, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.free_storage(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.free_storage(UUID, BIGINT) TO service_role;


-- ── 2. Agregar columna is_admin en profiles ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;


-- ── 3. Reemplazar RLS de fraud_detection con is_admin ────────────────────────
DO $$
BEGIN
  DROP POLICY IF EXISTS "Solo ADMIN ve fraud_detection" ON public.fraud_detection;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Solo ADMIN ve fraud_detection" ON public.fraud_detection
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );


-- ── 4. Verificación ───────────────────────────────────────────────────────────
SELECT
  p.proname                          AS funcion,
  has_function_privilege('anon',        p.oid, 'EXECUTE') AS anon_puede,
  has_function_privilege('authenticated',p.oid, 'EXECUTE') AS auth_puede,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_puede
FROM pg_proc p
WHERE p.proname IN ('check_storage_quota', 'update_storage_used', 'free_storage')
  AND p.pronamespace = 'public'::regnamespace;
