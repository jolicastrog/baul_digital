-- ============================================================================
-- MIGRACIÓN 009: Registro de consentimiento legal (Ley 1581 de 2012 Colombia)
-- ============================================================================

-- Agregar columnas de consentimiento a profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS accepted_terms_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version       VARCHAR(10);

-- Los usuarios existentes se marcan con versión legacy (registro anterior a la política)
UPDATE profiles
SET
  accepted_terms_at = created_at,
  terms_version     = 'legacy'
WHERE accepted_terms_at IS NULL;
