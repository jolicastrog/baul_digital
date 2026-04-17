-- ============================================================================
-- MIGRACIÓN 016: Aislamiento de bloques en trigger handle_new_user
--
-- Problema raíz confirmado:
--   El trigger tenía un único bloque BEGIN...EXCEPTION que agrupaba el
--   INSERT de profiles Y el PERFORM create_default_categories().
--   En PostgreSQL, cuando ocurre una excepción dentro de ese bloque,
--   se hace rollback de TODAS las operaciones del bloque (savepoint interno).
--   Si create_default_categories() fallaba, el INSERT del perfil también
--   se revertía, dejando el auth user sin perfil.
--
-- Solución:
--   Separar en dos bloques BEGIN...EXCEPTION independientes:
--   Bloque 1 → INSERT profiles   (si falla: log + RETURN NEW, no sigue)
--   Bloque 2 → create_default_categories  (si falla: log, perfil ya seguro)
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_cedula    TEXT;
  v_nombres   TEXT;
  v_apellidos TEXT;
  v_full_name TEXT;
BEGIN
  v_nombres   := nullif(trim(coalesce(NEW.raw_user_meta_data->>'nombres',   '')), '');
  v_apellidos := nullif(trim(coalesce(NEW.raw_user_meta_data->>'apellidos', '')), '');
  v_full_name := trim(
    coalesce(v_nombres, '') ||
    case when v_apellidos is not null then ' ' || v_apellidos else '' end
  );
  if v_full_name = '' then
    v_full_name := coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email);
  end if;

  v_cedula := nullif(trim(coalesce(NEW.raw_user_meta_data->>'cedula_unica', '')), '');
  if v_cedula is null then
    v_cedula := 'TEMP_' || NEW.id::text;
  end if;

  -- ── Bloque 1: Insertar perfil (aislado del resto) ─────────────────────────
  -- Si este bloque falla, el trigger hace RETURN NEW sin crear categorías.
  -- El perfil quedará pendiente y el register API lo creará directamente.
  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      nombres,
      apellidos,
      full_name,
      cedula_unica,
      cedula_tipo
    ) VALUES (
      NEW.id,
      lower(trim(NEW.email)),
      v_nombres,
      v_apellidos,
      v_full_name,
      v_cedula,
      coalesce(nullif(trim(NEW.raw_user_meta_data->>'cedula_tipo'), ''), 'CC')
    )
    ON CONFLICT (id) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user [perfil] usuario=% id=% estado=[%] detalle=%',
      NEW.email, NEW.id, SQLSTATE, SQLERRM;
    RETURN NEW;
  END;

  -- ── Bloque 2: Crear categorías por defecto (aislado del perfil) ───────────
  -- Si falla, el perfil ya está insertado y seguro. Solo se logra la advertencia.
  BEGIN
    PERFORM create_default_categories(NEW.id);

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user [categorias] usuario=% id=% estado=[%] detalle=%',
      NEW.email, NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── Verificación: el trigger debe existir y apuntar a la función ─────────────
SELECT
  tgname        AS trigger_nombre,
  tgenabled     AS habilitado,
  proname       AS funcion
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE tgname = 'on_auth_user_created';
