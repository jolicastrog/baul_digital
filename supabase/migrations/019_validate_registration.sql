-- ============================================================================
-- MIGRACIÓN 019: Función validate_registration + setup_new_user con validación
--
-- Problemas que resuelve:
--
--  1. La validación de cédula y email duplicados estaba solo en el API (TypeScript).
--     Si la consulta fallaba silenciosamente, el auth user se creaba y quedaba
--     huérfano (sin perfil) porque setup_new_user rechazaba la cédula duplicada
--     pero la API retornaba success de todas formas.
--
--  2. setup_new_user no validaba cédula antes del INSERT, confiando solo en que
--     el índice parcial lanzara unique_violation — lo cual dejaba auth users
--     huérfanos cuando la cédula ya existía.
--
-- Solución:
--  - validate_registration(): única fuente de verdad para validar cédula y email.
--    La API la llama ANTES de signUp(). Si falla o retorna error → rechaza.
--  - setup_new_user(): ahora valida cédula internamente ANTES del INSERT.
--    Si la cédula está tomada → asigna TEMP_ (no bloquea la creación del usuario,
--    el usuario deberá corregirla desde Configuración).
-- ============================================================================


-- ── 1. Función validate_registration ─────────────────────────────────────────
-- Retorna: { ok: true }
--      o:  { ok: false, field: 'cedula'|'email', message: '...' }
--
-- Notas:
--   - El email en auth.users ya lo garantiza Supabase Auth (UNIQUE en auth.users).
--     Aquí verificamos también en profiles por coherencia y para dar mensaje claro.
--   - La cédula NO la garantiza Supabase Auth, solo nuestro índice parcial.
--   - p_user_id_excluir permite reutilizar la función en actualizaciones de perfil
--     (excluye al propio usuario del chequeo).
CREATE OR REPLACE FUNCTION public.validate_registration(
  p_cedula         TEXT,
  p_email          TEXT,
  p_user_id_excluir UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cedula TEXT := trim(p_cedula);
  v_email  TEXT := lower(trim(p_email));
BEGIN
  -- Validar cédula (excluye valores TEMP_ y al propio usuario si es actualización)
  IF v_cedula NOT LIKE 'TEMP_%' THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE cedula_unica = v_cedula
        AND cedula_unica NOT LIKE 'TEMP_%'
        AND (p_user_id_excluir IS NULL OR id <> p_user_id_excluir)
    ) THEN
      RETURN jsonb_build_object(
        'ok',      false,
        'field',   'cedula',
        'message', 'Ese número de documento ya está registrado en otra cuenta.'
      );
    END IF;
  END IF;

  -- Validar email (solo en profiles — auth.users lo garantiza por separado)
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE email = v_email
      AND (p_user_id_excluir IS NULL OR id <> p_user_id_excluir)
  ) THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'field',   'email',
      'message', 'Este correo electrónico ya está registrado. Intenta iniciar sesión.'
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_registration FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.validate_registration TO service_role;


-- ── 2. setup_new_user actualizado — valida cédula antes del INSERT ─────────────
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
  v_cedula_tomada BOOLEAN := FALSE;
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

  -- Si no hay cédula → placeholder
  if v_cedula is null then
    v_cedula := 'TEMP_' || p_user_id::text;
  end if;

  -- Verificar si la cédula ya está tomada por otro usuario
  IF v_cedula NOT LIKE 'TEMP_%' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE cedula_unica = v_cedula
        AND cedula_unica NOT LIKE 'TEMP_%'
        AND id <> p_user_id
    ) INTO v_cedula_tomada;

    IF v_cedula_tomada THEN
      -- Asignar placeholder: el usuario accede al sistema y debe corregirla
      RAISE WARNING 'setup_new_user: cédula % ya tomada para usuario %. Asignando TEMP_.',
        v_cedula, p_email;
      v_cedula := 'TEMP_' || p_user_id::text;
    END IF;
  END IF;

  -- ── Bloque A: perfil (aislado) ──────────────────────────────────────────────
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
    RETURN;
  END;

  -- ── Bloque B: categorías por defecto (aislado del perfil) ──────────────────
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


-- ── 3. Verificación de funciones creadas ─────────────────────────────────────
SELECT
  p.proname                                      AS funcion,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS argumentos
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('validate_registration', 'setup_new_user', 'create_default_categories')
ORDER BY p.proname;
