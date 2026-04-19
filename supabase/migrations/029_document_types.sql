-- ============================================================================
-- MIGRACIÓN 029: Tabla document_types — catálogo administrable de tipos de doc
--
-- Objetivo:
--   Reemplazar el CHECK constraint hardcodeado en profiles.cedula_tipo por una
--   tabla administrable. El admin puede habilitar/deshabilitar tipos o crear
--   nuevos sin tocar código ni migraciones.
--
-- Arquitectura:
--   - Tabla catálogo (sin user_id) — igual que plans. No requiere multi-tenant.
--   - RLS: SELECT público (anon + authenticated), INSERT/UPDATE/DELETE solo
--     service_role (administración futura desde panel admin).
--   - FK profiles.cedula_tipo → document_types.code con ON UPDATE CASCADE.
--   - Trigger BEFORE INSERT en profiles valida is_active = TRUE.
--   - RC deshabilitado (menores de 14 años — política de la plataforma).
-- ============================================================================


-- ── 1. Crear tabla document_types ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_types (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  min_age_years INT  DEFAULT NULL,  -- informativo, no se verifica automáticamente
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_types_active
  ON public.document_types(is_active);


-- ── 2. Insertar todos los tipos (activos e inactivos) ────────────────────────
-- Se insertan TODOS para que la FK no rompa perfiles históricos.
-- is_active = FALSE → no aparece en el formulario de registro.
INSERT INTO public.document_types
  (code, name, description, min_age_years, is_active, sort_order)
VALUES
  ('CC',  'Cédula de Ciudadanía',          'Documento de identidad para ciudadanos colombianos mayores de 18 años', 18,   TRUE,  1),
  ('TI',  'Tarjeta de Identidad',           'Documento para colombianos entre 14 y 17 años',                        14,   TRUE,  2),
  ('RC',  'Registro Civil',                 'Documento para menores de 14 años — no permitido en esta plataforma',  NULL, FALSE, 3),
  ('CE',  'Cédula de Extranjería',          'Documento para extranjeros residentes en Colombia',                    NULL, TRUE,  4),
  ('PA',  'Pasaporte',                      'Pasaporte internacional',                                              NULL, TRUE,  5),
  ('NIT', 'NIT Empresarial',                'Número de Identificación Tributaria para empresas',                    NULL, TRUE,  6),
  ('PEP', 'Permiso Especial de Permanencia','Permiso para ciudadanos venezolanos',                                  NULL, TRUE,  7),
  ('PPT', 'Permiso de Protección Temporal', 'Permiso de protección temporal para migrantes',                       NULL, TRUE,  8)
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  min_age_years = EXCLUDED.min_age_years,
  is_active     = EXCLUDED.is_active,
  sort_order    = EXCLUDED.sort_order,
  updated_at    = NOW();


-- ── 3. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tipos de documento visibles para todos" ON public.document_types
  FOR SELECT USING (TRUE);

REVOKE INSERT, UPDATE, DELETE ON public.document_types FROM PUBLIC, anon, authenticated;
GRANT  SELECT                  ON public.document_types TO anon, authenticated;
GRANT  ALL                     ON public.document_types TO service_role;


-- ── 4. Updated_at trigger ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_update_document_types_timestamp ON public.document_types;

CREATE TRIGGER trg_update_document_types_timestamp
  BEFORE UPDATE ON public.document_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ── 5. Reemplazar CHECK constraint por FK ────────────────────────────────────
-- Primero asegurar que todos los valores existentes en profiles tengan su
-- correspondiente código en document_types (el INSERT anterior los cubre).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cedula_tipo_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_cedula_tipo
  FOREIGN KEY (cedula_tipo)
  REFERENCES public.document_types(code)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;


-- ── 6. Trigger: validar is_active en nuevos registros ────────────────────────
-- Bloquea INSERT de perfiles con un tipo de documento deshabilitado.
-- No aplica a UPDATE para no afectar perfiles históricos con tipos inactivos.
CREATE OR REPLACE FUNCTION public.validate_cedula_tipo_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cedula_tipo IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.document_types
      WHERE code = NEW.cedula_tipo AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'DOCUMENT_TYPE_INACTIVE: El tipo de documento "%" no está habilitado para registro.',
        NEW.cedula_tipo;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_cedula_tipo ON public.profiles;

CREATE TRIGGER trg_validate_cedula_tipo
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_cedula_tipo_active();


-- ── 7. Verificación ───────────────────────────────────────────────────────────
SELECT
  code,
  name,
  is_active,
  CASE WHEN is_active THEN '✅ habilitado' ELSE '🚫 deshabilitado' END AS estado
FROM public.document_types
ORDER BY sort_order;
