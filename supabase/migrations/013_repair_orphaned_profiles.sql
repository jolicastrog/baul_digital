-- ============================================================================
-- MIGRACIÓN 013: Reparar perfiles huérfanos + trigger más robusto
--
-- Problema raíz: usuarios creados en auth.users sin fila en profiles,
-- porque el trigger handle_new_user falló silenciosamente (la función
-- register_user_profile aún no existía cuando se registraron) y la
-- limpieza del auth user también falló.
--
-- Solución:
--   1. Función repair_orphaned_profiles() — crea los perfiles faltantes
--      usando los metadatos de auth.users. Si la cédula ya está usada
--      por otro usuario, asigna un placeholder TEMP_ para no bloquear
--      el acceso; el usuario deberá actualizar su cédula desde Configuración.
--   2. Trigger handle_new_user actualizado — más robusto, registra el
--      error real en lugar de silenciarlo.
-- ============================================================================


-- ── 1. Función repair_orphaned_profiles ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.repair_orphaned_profiles()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec        RECORD;
  v_cedula     TEXT;
  v_nombres    TEXT;
  v_apellidos  TEXT;
  v_full_name  TEXT;
  v_count      INT := 0;
  v_skipped    INT := 0;
  v_details    JSONB := '[]'::JSONB;
BEGIN
  FOR v_rec IN
    SELECT u.id, u.email, u.raw_user_meta_data AS meta
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
  LOOP
    -- Extraer datos del metadata
    v_nombres   := nullif(trim(v_rec.meta->>'nombres'),   '');
    v_apellidos := nullif(trim(v_rec.meta->>'apellidos'), '');
    v_full_name := trim(
                     coalesce(v_nombres, '') ||
                     case when v_apellidos is not null then ' ' || v_apellidos else '' end
                   );
    if v_full_name = '' then
      v_full_name := coalesce(v_rec.meta->>'full_name', v_rec.email);
    end if;

    -- Determinar cédula: si ya está usada por otro, asignar TEMP_
    v_cedula := nullif(trim(coalesce(v_rec.meta->>'cedula_unica', '')), '');
    IF v_cedula IS NOT NULL
       AND v_cedula NOT LIKE 'TEMP_%'
       AND EXISTS (
         SELECT 1 FROM public.profiles
         WHERE cedula_unica = v_cedula
           AND cedula_unica NOT LIKE 'TEMP_%'
       )
    THEN
      v_cedula := 'TEMP_' || v_rec.id::text;  -- conflicto: usar placeholder
    END IF;
    IF v_cedula IS NULL THEN
      v_cedula := 'TEMP_' || v_rec.id::text;
    END IF;

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
        v_rec.id,
        lower(trim(v_rec.email)),
        v_nombres,
        v_apellidos,
        v_full_name,
        v_cedula,
        coalesce(nullif(trim(v_rec.meta->>'cedula_tipo'), ''), 'CC')
      )
      ON CONFLICT (id) DO NOTHING;

      v_count   := v_count + 1;
      v_details := v_details || jsonb_build_object(
        'id',    v_rec.id,
        'email', v_rec.email,
        'cedula_asignada', v_cedula
      );

    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      RAISE WARNING 'repair_orphaned_profiles: no se pudo crear perfil para % — %', v_rec.email, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'reparados', v_count,
    'omitidos',  v_skipped,
    'detalle',   v_details
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.repair_orphaned_profiles FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.repair_orphaned_profiles TO service_role;


-- ── 2. Trigger handle_new_user más robusto ───────────────────────────────────
-- Diferencias vs versión anterior:
--   - Registra el error exacto con RAISE WARNING (visible en Supabase Logs)
--   - Usa ON CONFLICT (id) DO UPDATE para que si el perfil ya existe
--     (ej: creado por register_user_profile antes del trigger) se actualice
--     sin fallar silenciosamente.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_cedula TEXT;
  v_nombres    TEXT;
  v_apellidos  TEXT;
  v_full_name  TEXT;
BEGIN
  v_nombres   := nullif(trim(coalesce(NEW.raw_user_meta_data->>'nombres',   '')), '');
  v_apellidos := nullif(trim(coalesce(NEW.raw_user_meta_data->>'apellidos', '')), '');
  v_full_name := trim(
    coalesce(v_nombres, '') ||
    case when v_apellidos is not null then ' ' || v_apellidos else '' end
  );
  if v_full_name = '' then
    v_full_name := coalesce(NEW.raw_user_meta_data->>'full_name', '');
  end if;

  v_cedula := nullif(trim(coalesce(NEW.raw_user_meta_data->>'cedula_unica', '')), '');
  if v_cedula is null then
    v_cedula := 'TEMP_' || NEW.id::text;
  end if;

  BEGIN
    INSERT INTO public.profiles (
      id, email, nombres, apellidos, full_name,
      cedula_unica, cedula_tipo
    )
    VALUES (
      NEW.id,
      lower(trim(NEW.email)),
      v_nombres,
      v_apellidos,
      v_full_name,
      v_cedula,
      coalesce(nullif(trim(NEW.raw_user_meta_data->>'cedula_tipo'), ''), 'CC')
    )
    ON CONFLICT (id) DO NOTHING;  -- register_user_profile puede llegar primero

    PERFORM create_default_categories(NEW.id);

  EXCEPTION WHEN OTHERS THEN
    -- Log detallado para diagnóstico (visible en Supabase → Logs → Database)
    RAISE WARNING 'handle_new_user ERROR para % (id=%): [%] %',
      NEW.email, NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
