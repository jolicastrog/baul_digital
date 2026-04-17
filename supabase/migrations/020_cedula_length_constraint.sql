-- ============================================================================
-- MIGRACIÓN 020: Constraint de longitud para cedula_unica
--
-- Regla: mínimo 3 caracteres, máximo 20 (cubre todos los tipos de documento
-- colombianos: CC hasta 10, PA/PEP/PPT hasta 20).
-- Excluye valores TEMP_ que usa setup_new_user como placeholder.
-- ============================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_cedula_unica_length;

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_cedula_unica_length
  CHECK (
    cedula_unica LIKE 'TEMP_%'
    OR (length(cedula_unica) >= 3 AND length(cedula_unica) <= 20)
  );

-- Verificación
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname = 'chk_cedula_unica_length';
