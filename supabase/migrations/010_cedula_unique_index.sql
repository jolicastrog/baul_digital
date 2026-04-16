-- ============================================================================
-- MIGRACIÓN 010: Índice único parcial en cedula_unica
-- Excluye los valores TEMP_ que son placeholders temporales
-- Garantiza unicidad a nivel de BD, independiente de validaciones del API
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cedula_unica_unique
ON profiles(cedula_unica)
WHERE cedula_unica NOT LIKE 'TEMP_%';
