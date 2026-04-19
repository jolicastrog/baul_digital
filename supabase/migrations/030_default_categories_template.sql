-- ============================================================================
-- MIGRACIÓN 030: Tabla default_categories_template + refactor create_default_categories
--
-- Objetivo:
--   Reemplazar las categorías por defecto hardcodeadas en la función
--   create_default_categories por una tabla administrable. El admin puede
--   añadir, editar, activar/desactivar categorías template sin tocar código.
--
-- Arquitectura:
--   - Tabla catálogo (sin user_id) — igual que plans y document_types.
--   - RLS: SELECT público, INSERT/UPDATE/DELETE solo service_role.
--   - create_default_categories pasa a leer desde esta tabla (solo is_active=TRUE).
--   - Las categorías ya creadas en usuarios existentes no se ven afectadas.
-- ============================================================================


-- ── 1. Crear tabla default_categories_template ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.default_categories_template (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  description TEXT,
  icon        TEXT    NOT NULL DEFAULT 'folder',
  color_code  TEXT    NOT NULL DEFAULT '#475569',
  sort_order  INT     NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dct_active_sort
  ON public.default_categories_template(is_active, sort_order);


-- ── 2. Seed: las 6 categorías por defecto (mismas que estaban hardcodeadas) ──
INSERT INTO public.default_categories_template
  (name, description, icon, color_code, sort_order, is_active)
VALUES
  ('Identidad',  'Cédula, pasaporte y documentos de identidad',  'fingerprint',    '#1e40af', 1, TRUE),
  ('Salud',      'Carnets médicos, resultados y pólizas de salud','heart-pulse',    '#dc2626', 2, TRUE),
  ('Educación',  'Diplomas, certificados y títulos académicos',   'graduation-cap', '#7c3aed', 3, TRUE),
  ('Financiero', 'Extractos bancarios, contratos y comprobantes', 'banknote',       '#059669', 4, TRUE),
  ('Propiedad',  'Escrituras, contratos de arriendo y vehículos', 'home',           '#d97706', 5, TRUE),
  ('Otros',      'Documentos que no encajan en otras categorías', 'folder',         '#475569', 6, TRUE)
ON CONFLICT (id) DO NOTHING;


-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.default_categories_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Template de categorías visible para todos"
  ON public.default_categories_template
  FOR SELECT USING (TRUE);

REVOKE INSERT, UPDATE, DELETE
  ON public.default_categories_template
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.default_categories_template TO anon, authenticated;
GRANT ALL    ON public.default_categories_template TO service_role;


-- ── 4. Trigger updated_at ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_update_dct_timestamp ON public.default_categories_template;

CREATE TRIGGER trg_update_dct_timestamp
  BEFORE UPDATE ON public.default_categories_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ── 5. Actualizar create_default_categories para leer desde la tabla ──────────
-- Ahora itera sobre default_categories_template WHERE is_active = TRUE,
-- ordenado por sort_order. ON CONFLICT (user_id, name) DO NOTHING preserva
-- el comportamiento existente.
CREATE OR REPLACE FUNCTION public.create_default_categories(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tpl RECORD;
BEGIN
  FOR v_tpl IN
    SELECT name, icon, color_code, sort_order
    FROM   public.default_categories_template
    WHERE  is_active = TRUE
    ORDER  BY sort_order
  LOOP
    INSERT INTO public.categories (user_id, name, icon, color_code, sort_order, is_default)
    VALUES (p_user_id, v_tpl.name, v_tpl.icon, v_tpl.color_code, v_tpl.sort_order, TRUE)
    ON CONFLICT (user_id, name) DO NOTHING;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_default_categories FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_default_categories TO service_role;


-- ── 6. Verificación ───────────────────────────────────────────────────────────
SELECT
  name,
  icon,
  color_code,
  sort_order,
  CASE WHEN is_active THEN '✅ activa' ELSE '🚫 inactiva' END AS estado
FROM public.default_categories_template
ORDER BY sort_order;
