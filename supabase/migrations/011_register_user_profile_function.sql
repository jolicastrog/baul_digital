-- ============================================================================
-- MIGRACIÓN 011: Función register_user_profile
-- Consolida la validación y el upsert del perfil en un solo procedimiento
-- de base de datos para reducir la carga en el frontend y garantizar
-- atomicidad en la creación del perfil.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_user_profile(
  p_user_id        UUID,
  p_email          TEXT,
  p_nombres        TEXT,
  p_apellidos      TEXT,
  p_cedula_unica   TEXT,
  p_cedula_tipo    TEXT,
  p_accepted_terms_at TIMESTAMPTZ,
  p_terms_version  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cedula_norm TEXT;
  v_email_norm  TEXT;
BEGIN
  v_email_norm  := lower(trim(p_email));
  v_cedula_norm := trim(p_cedula_unica);

  -- 1. Verificar email único en profiles (excluye al propio usuario recién creado)
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE email = v_email_norm
      AND id <> p_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'email_taken', 'message', 'Este correo electrónico ya está registrado. Intenta iniciar sesión.');
  END IF;

  -- 2. Verificar cédula única en profiles (excluye TEMPs y al propio usuario)
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE cedula_unica = v_cedula_norm
      AND cedula_unica NOT LIKE 'TEMP_%'
      AND id <> p_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'cedula_taken', 'message', 'Ese número de documento ya está registrado en otra cuenta.');
  END IF;

  -- 3. Upsert del perfil
  INSERT INTO public.profiles (
    id,
    email,
    nombres,
    apellidos,
    full_name,
    cedula_unica,
    cedula_tipo,
    accepted_terms_at,
    terms_version
  ) VALUES (
    p_user_id,
    v_email_norm,
    trim(p_nombres),
    trim(p_apellidos),
    trim(p_nombres) || ' ' || trim(p_apellidos),
    v_cedula_norm,
    p_cedula_tipo,
    p_accepted_terms_at,
    p_terms_version
  )
  ON CONFLICT (id) DO UPDATE SET
    email             = EXCLUDED.email,
    nombres           = EXCLUDED.nombres,
    apellidos         = EXCLUDED.apellidos,
    full_name         = EXCLUDED.full_name,
    cedula_unica      = EXCLUDED.cedula_unica,
    cedula_tipo       = EXCLUDED.cedula_tipo,
    accepted_terms_at = EXCLUDED.accepted_terms_at,
    terms_version     = EXCLUDED.terms_version,
    updated_at        = now();

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN unique_violation THEN
  -- El índice parcial de cedula_unica atrapó un duplicado
  RETURN jsonb_build_object('error', 'cedula_taken', 'message', 'Ese número de documento ya está registrado en otra cuenta.');
WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'db_error', 'message', SQLERRM);
END;
$$;

-- Solo el rol service_role puede ejecutar esta función (llamada desde el API con la service key)
REVOKE EXECUTE ON FUNCTION public.register_user_profile FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.register_user_profile TO service_role;
