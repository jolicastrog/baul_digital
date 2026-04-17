-- ============================================================================
-- MIGRACIÓN 018: Función consolidada setup_new_user + trigger simplificado
--
-- Objetivo:
--   Centralizar la creación de perfil y categorías por defecto en una sola
--   función de BD. El trigger la llama, y es el ÚNICO punto donde esto ocurre.
--
-- Causa raíz confirmada (ver análisis en comentarios de migraciones 014-016):
--   1. FK IMMEDIATE (mig 014) impedía el INSERT de profiles dentro del trigger
--      porque auth.users no era visible desde public en el mismo TX.
--   2. Un solo bloque BEGIN...EXCEPTION agrupaba profiles + categorías:
--      si create_default_categories fallaba por cualquier motivo, el savepoint
--      interno revertía también el INSERT de profiles.
--
-- Solución:
--   - FK DEFERRABLE INITIALLY DEFERRED (mig 015) resuelve el punto 1.
--   - Dos bloques BEGIN...EXCEPTION independientes resuelven el punto 2.
--   - Función setup_new_user encapsula ambos bloques: el trigger queda mínimo.
-- ============================================================================


-- ── 1. Función consolidada setup_new_user ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.setup_new_user(
  p_user_id      UUID,
  p_email        TEXT,
  p_nombres      TEXT,
  p_apellidos    TEXT,
  p_cedula_unica TEXT,
  p_cedula_tipo  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cedula    TEXT;
  v_nombres   TEXT;
  v_apellidos TEXT;
  v_full_name TEXT;
BEGIN
  v_nombres   := nullif(trim(coalesce(p_nombres,   '')), '');
  v_apellidos := nullif(trim(coalesce(p_apellidos, '')), '');
  v_full_name := trim(
    coalesce(v_nombres, '') ||
    case when v_apellidos is not null then ' ' || v_apellidos else '' end
  );
  if v_full_name = '' then
    v_full_name := lower(trim(p_email));
  end if;

  v_cedula := nullif(trim(coalesce(p_cedula_unica, '')), '');
  if v_cedula is null then
    v_cedula := 'TEMP_' || p_user_id::text;
  end if;

  -- ── Bloque A: perfil (aislado) ──────────────────────────────────────────────
  -- ON CONFLICT DO NOTHING: si register_user_profile o el trigger ya lo creó,
  -- no falla ni sobreescribe.
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
      p_user_id,
      lower(trim(p_email)),
      v_nombres,
      v_apellidos,
      v_full_name,
      v_cedula,
      coalesce(nullif(trim(coalesce(p_cedula_tipo, '')), ''), 'CC')
    )
    ON CONFLICT (id) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'setup_new_user [perfil] id=% email=% estado=[%] detalle=%',
      p_user_id, p_email, SQLSTATE, SQLERRM;
    RETURN; -- sin perfil no tiene sentido crear categorías
  END;

  -- ── Bloque B: categorías por defecto (aislado del perfil) ──────────────────
  -- Si falla, el perfil ya está guardado. Se registra advertencia y continúa.
  BEGIN
    PERFORM public.create_default_categories(p_user_id);

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'setup_new_user [categorias] id=% email=% estado=[%] detalle=%',
      p_user_id, p_email, SQLSTATE, SQLERRM;
  END;

END;
$$;

REVOKE EXECUTE ON FUNCTION public.setup_new_user FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.setup_new_user TO service_role;


-- ── 2. Trigger handle_new_user — mínimo, delega en setup_new_user ─────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.setup_new_user(
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'nombres',
    NEW.raw_user_meta_data->>'apellidos',
    NEW.raw_user_meta_data->>'cedula_unica',
    NEW.raw_user_meta_data->>'cedula_tipo'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 3. Reparar usuarios existentes sin categorías ────────────────────────────
DO $$
DECLARE
  v_rec      RECORD;
  v_creados  INT := 0;
  v_omitidos INT := 0;
BEGIN
  FOR v_rec IN
    SELECT p.id, p.email
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.categories c WHERE c.user_id = p.id
    )
  LOOP
    BEGIN
      PERFORM public.create_default_categories(v_rec.id);
      v_creados := v_creados + 1;
      RAISE NOTICE 'Categorías creadas para: %', v_rec.email;
    EXCEPTION WHEN OTHERS THEN
      v_omitidos := v_omitidos + 1;
      RAISE WARNING 'No se pudieron crear categorías para %: [%] %',
        v_rec.email, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '=== Reparación: % usuario(s) reparados, % omitidos ===',
    v_creados, v_omitidos;
END $$;


-- ── 4. Verificación final ────────────────────────────────────────────────────
SELECT
  p.email,
  COUNT(c.id) AS categorias,
  CASE WHEN COUNT(c.id) = 0 THEN '❌ Sin categorías' ELSE '✅ OK' END AS estado
FROM public.profiles p
LEFT JOIN public.categories c ON c.user_id = p.id
GROUP BY p.email
ORDER BY p.email;
