-- =============================================================
-- FIX 038: protect_default_categories permite CASCADE de usuario
--
-- Problema: el trigger BEFORE DELETE en categories lanzaba
--   RAISE EXCEPTION para CUALQUIER borrado de categoría default,
--   incluyendo el CASCADE del sistema cuando se elimina un usuario.
--   Esto causaba un 500 en GoTrue al intentar borrar desde el
--   dashboard de Supabase.
--
-- Solución: si el perfil del usuario ya no existe en la misma
--   transacción (porque fue borrado por CASCADE), se trata de
--   una eliminación del sistema → se permite.
--   Si el perfil sigue existiendo, es una acción del usuario
--   intentando borrar una categoría default → se bloquea.
-- =============================================================

CREATE OR REPLACE FUNCTION public.protect_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_default THEN
    -- Permitir si el usuario padre ya no existe (CASCADE de eliminación de cuenta)
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.user_id) THEN
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END IF;

    -- Bloquear: el usuario está intentando modificar/borrar una categoría por defecto
    RAISE EXCEPTION 'DEFAULT_CATEGORY_PROTECTED: Las categorías por defecto no se pueden modificar ni eliminar.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
