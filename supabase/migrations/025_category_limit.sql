-- ============================================================================
-- MIGRACIÓN 025: Límite de categorías por plan
--
-- Objetivo:
--   Agregar columna max_categories a la tabla plans y crear un trigger
--   BEFORE INSERT en categories que valide el límite según el plan del usuario.
--
-- Límites:
--   free       → 6  categorías  (ya creadas por defecto al registrarse)
--   premium    → 25 categorías
--   enterprise → ilimitadas     (NULL = sin límite)
-- ============================================================================


-- ── 1. Agregar columna max_categories a plans ─────────────────────────────────
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_categories integer;

UPDATE public.plans SET max_categories = 6    WHERE code = 'free';
UPDATE public.plans SET max_categories = 25   WHERE code = 'premium';
UPDATE public.plans SET max_categories = NULL WHERE code = 'enterprise';


-- ── 2. Función trigger check_category_limit ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_category_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

REVOKE EXECUTE ON FUNCTION public.check_category_limit FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_category_limit TO service_role;


-- ── 3. Trigger BEFORE INSERT en categories ────────────────────────────────────
DROP TRIGGER IF EXISTS trg_check_category_limit ON public.categories;

CREATE TRIGGER trg_check_category_limit
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.check_category_limit();


-- ── 4. Verificación final ────────────────────────────────────────────────────
SELECT
  code,
  name,
  max_categories,
  CASE
    WHEN max_categories IS NULL THEN 'ilimitadas'
    ELSE max_categories::text || ' categorías'
  END AS limite
FROM public.plans
ORDER BY
  CASE code WHEN 'free' THEN 1 WHEN 'premium' THEN 2 WHEN 'enterprise' THEN 3 END;
