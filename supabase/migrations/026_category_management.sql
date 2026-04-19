-- ============================================================================
-- MIGRACIÓN 026: Gestión de categorías por plan
--
-- Objetivo:
--   Permitir a usuarios premium/enterprise crear, renombrar y eliminar
--   categorías personalizadas, protegiendo las 6 categorías por defecto.
--
-- Cambios:
--   1. Columna is_default en categories
--   2. Marcar categorías existentes como default
--   3. Actualizar create_default_categories para marcar is_default = TRUE
--   4. Trigger protect_default_categories — bloquea UPDATE/DELETE en defaults
--   5. Función delete_category — verifica documentos antes de eliminar
--   6. Actualizar check_category_limit — mensaje mejorado para plan free
-- ============================================================================


-- ── 1. Columna is_default ─────────────────────────────────────────────────────
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;


-- ── 2. Marcar categorías existentes por defecto ───────────────────────────────
UPDATE public.categories
SET is_default = TRUE
WHERE name IN ('Identidad', 'Salud', 'Educación', 'Financiero', 'Propiedad', 'Otros');


-- ── 3. Actualizar create_default_categories ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_default_categories(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, icon, color_code, sort_order, is_default)
  VALUES
    (p_user_id, 'Identidad',  'fingerprint',   '#1e40af', 1, TRUE),
    (p_user_id, 'Salud',      'heart-pulse',   '#dc2626', 2, TRUE),
    (p_user_id, 'Educación',  'graduation-cap','#7c3aed', 3, TRUE),
    (p_user_id, 'Financiero', 'banknote',       '#059669', 4, TRUE),
    (p_user_id, 'Propiedad',  'home',           '#d97706', 5, TRUE),
    (p_user_id, 'Otros',      'folder',         '#475569', 6, TRUE)
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_default_categories FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_default_categories TO service_role;


-- ── 4. Función y trigger protect_default_categories ───────────────────────────
CREATE OR REPLACE FUNCTION public.protect_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_default THEN
    RAISE EXCEPTION 'DEFAULT_CATEGORY_PROTECTED: Las categorías por defecto no se pueden modificar ni eliminar.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_default_categories ON public.categories;

CREATE TRIGGER trg_protect_default_categories
  BEFORE UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.protect_default_categories();


-- ── 5. Función delete_category ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_category(
  p_category_id UUID,
  p_user_id     UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.categories WHERE id = p_category_id
  ) THEN
    RAISE EXCEPTION 'CATEGORY_NOT_FOUND: Categoría no encontrada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.categories WHERE id = p_category_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'CATEGORY_ACCESS_DENIED: No tienes permiso para eliminar esta categoría.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.categories WHERE id = p_category_id AND is_default = TRUE
  ) THEN
    RAISE EXCEPTION 'DEFAULT_CATEGORY_PROTECTED: Las categorías por defecto no se pueden eliminar.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.documents WHERE category_id = p_category_id
  ) THEN
    RAISE EXCEPTION 'CATEGORY_HAS_DOCUMENTS: Esta categoría tiene % documento(s). Muévelos o elimínalos antes de borrarla.',
      (SELECT COUNT(*)::integer FROM public.documents WHERE category_id = p_category_id);
  END IF;

  DELETE FROM public.categories WHERE id = p_category_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    p_user_id, 'CATEGORY_DELETED', 'category', p_category_id,
    jsonb_build_object('category_id', p_category_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_category FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_category TO service_role;


-- ── 6. Actualizar check_category_limit (mensaje mejorado) ────────────────────
CREATE OR REPLACE FUNCTION public.check_category_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bloquear plan free explícitamente
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.user_id AND plan_type = 'free'
  ) AND NEW.is_default = FALSE THEN
    RAISE EXCEPTION 'PLAN_FREE_RESTRICTED: El plan gratuito no permite crear categorías personalizadas. Actualiza tu plan.';
  END IF;

  -- Verificar límite del plan
  IF EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.plans pl ON pl.code = pr.plan_type
    WHERE pr.id = NEW.user_id
      AND pl.max_categories IS NOT NULL
      AND (
        SELECT COUNT(*)::integer
        FROM public.categories
        WHERE user_id = NEW.user_id
      ) >= pl.max_categories
  ) THEN
    RAISE EXCEPTION 'CATEGORY_LIMIT_REACHED: Tu plan permite un máximo de % categorías.',
      (SELECT pl2.max_categories
       FROM public.profiles pr2
       JOIN public.plans pl2 ON pl2.code = pr2.plan_type
       WHERE pr2.id = NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;


-- ── 7. Verificación final ─────────────────────────────────────────────────────
SELECT
  c.name,
  c.is_default,
  p.email
FROM public.categories c
JOIN public.profiles p ON p.id = c.user_id
ORDER BY p.email, c.sort_order;
