-- ============================================================================
-- MIGRACIÓN 012: Funciones de base de datos para gestión del perfil
--   - get_user_profile   → retorna el perfil completo de un usuario
--   - update_user_profile → valida y actualiza datos del perfil
-- Ambas se ejecutan con SECURITY DEFINER (elude RLS) y solo el
-- service_role tiene permiso de ejecución.
-- ============================================================================

-- ── 1. get_user_profile ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile JSONB;
BEGIN
  SELECT to_jsonb(p) INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'Perfil no encontrado.');
  END IF;

  RETURN jsonb_build_object('found', true, 'profile', v_profile);
END;
$$;

-- ── 2. update_user_profile ───────────────────────────────────────────────────
-- Parámetros opcionales: si se pasan NULL no se tocan esos campos.
CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_user_id      UUID,
  p_nombres      TEXT    DEFAULT NULL,
  p_apellidos    TEXT    DEFAULT NULL,
  p_cedula_unica TEXT    DEFAULT NULL,
  p_cedula_tipo  TEXT    DEFAULT NULL,
  p_phone        TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile JSONB;
BEGIN
  -- Verificar que la cédula no la use otro usuario (excluye al propio)
  IF p_cedula_unica IS NOT NULL
     AND p_cedula_unica NOT LIKE 'TEMP_%'
     AND EXISTS (
       SELECT 1 FROM public.profiles
       WHERE cedula_unica = trim(p_cedula_unica)
         AND id <> p_user_id
     )
  THEN
    RETURN jsonb_build_object(
      'error', 'cedula_taken',
      'message', 'Ese número de documento ya está registrado en otra cuenta.'
    );
  END IF;

  -- Actualizar solo los campos enviados (NULL = no cambiar)
  UPDATE public.profiles
  SET
    nombres      = COALESCE(trim(p_nombres),      nombres),
    apellidos    = COALESCE(trim(p_apellidos),     apellidos),
    cedula_unica = COALESCE(trim(p_cedula_unica),  cedula_unica),
    cedula_tipo  = COALESCE(p_cedula_tipo,         cedula_tipo),
    phone        = CASE
                     WHEN p_phone IS NOT NULL THEN nullif(trim(p_phone), '')
                     ELSE phone
                   END,
    updated_at   = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'Perfil no encontrado.');
  END IF;

  -- Retornar el perfil actualizado
  SELECT to_jsonb(p) INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;

  RETURN jsonb_build_object('success', true, 'profile', v_profile);

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object(
    'error', 'cedula_taken',
    'message', 'Ese número de documento ya está registrado en otra cuenta.'
  );
WHEN check_violation THEN
  RETURN jsonb_build_object(
    'error', 'invalid_value',
    'message', 'Uno o más valores no son válidos. Verifica el tipo de documento.'
  );
WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'db_error', 'message', SQLERRM);
END;
$$;

-- ── Permisos ─────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.get_user_profile    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_user_profile FROM PUBLIC;

GRANT  EXECUTE ON FUNCTION public.get_user_profile    TO service_role;
GRANT  EXECUTE ON FUNCTION public.update_user_profile TO service_role;
