-- ============================================================================
-- MIGRACIÓN 014: Integridad referencial completa y robustez del sistema
--
-- Problemas que resuelve:
--
--  1. profiles NO tenía FK → auth.users, por eso borrar un auth user
--     NO borraba su profile. Se agrega ON DELETE CASCADE para que la
--     eliminación de un auth user borre automáticamente su profile y
--     todos los datos relacionados (categorías, documentos, etc.).
--
--  2. La constraint UNIQUE "completa" de cedula_unica (migration 001)
--     es incompatible con el índice parcial de migration 010. Cuando el
--     trigger intentaba insertar con una cédula ya usada (aunque fuera
--     de otro user), la violación de unicidad hacía fallar el INSERT y
--     el perfil nunca se creaba. Se elimina la constraint completa y
--     se deja solo el índice parcial (excluye TEMP_).
--
--  3. La función register_user_profile tenía un chequeo de email que
--     podía encontrar falsos positivos con profiles huérfanos.
--     Se elimina ese chequeo (Supabase auth ya garantiza email único).
--
--  4. Se limpian los profiles huérfanos existentes (sin auth user),
--     luego se agregan las relaciones FK correctas.
-- ============================================================================


-- ── PASO 1: Eliminar profiles huérfanos ─────────────────────────────────────
-- Primero borramos los registros en tablas hijas para no violar FKs existentes
DELETE FROM public.audit_logs
WHERE user_id IS NOT NULL
  AND user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.categories
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.documents
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.subscriptions
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.alerts
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);


-- ── PASO 2: Agregar FK profiles → auth.users con CASCADE DELETE ──────────────
-- Esto garantiza que al borrar un auth user desde Supabase Auth (UI o API),
-- su profile se borre automáticamente. Sin esto, quedan huérfanos.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS fk_profiles_auth_user;

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_auth_user
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;


-- ── PASO 3: Corregir constraint UNIQUE de cedula_unica ───────────────────────
-- El UNIQUE original (migration 001) cubre TODOS los valores, impidiendo
-- que el trigger inserte un profile cuando la cédula ya existe aunque sea
-- como TEMP_. Lo reemplazamos por el índice parcial de migration 010.
-- El índice parcial solo cubre cedulas reales (NOT LIKE 'TEMP_%') y ya existe.

-- Eliminar la constraint UNIQUE completa (deja solo NOT NULL en la columna)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cedula_unica_key;

-- Asegurarse de que el índice parcial de migration 010 existe
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cedula_unica_unique
  ON public.profiles(cedula_unica)
  WHERE cedula_unica NOT LIKE 'TEMP_%';


-- ── PASO 4: Actualizar register_user_profile ─────────────────────────────────
-- Eliminar el chequeo de email (Supabase auth ya lo garantiza a nivel de
-- auth.users; el chequeo en profiles daba falsos positivos con huérfanos).
-- Mantener el chequeo de cédula (regla de negocio, no la garantiza auth).
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
BEGIN
  v_cedula_norm := trim(p_cedula_unica);

  -- Verificar cédula única (excluye TEMP_ y al propio usuario)
  IF v_cedula_norm NOT LIKE 'TEMP_%'
     AND EXISTS (
       SELECT 1 FROM public.profiles
       WHERE cedula_unica = v_cedula_norm
         AND cedula_unica NOT LIKE 'TEMP_%'
         AND id <> p_user_id
     )
  THEN
    RETURN jsonb_build_object(
      'error',   'cedula_taken',
      'message', 'Ese número de documento ya está registrado en otra cuenta.'
    );
  END IF;

  -- Upsert del perfil (inserta si no existe, actualiza si ya lo creó el trigger)
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
    lower(trim(p_email)),
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
  RETURN jsonb_build_object(
    'error',   'cedula_taken',
    'message', 'Ese número de documento ya está registrado en otra cuenta.'
  );
WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'db_error', 'message', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_user_profile FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.register_user_profile TO service_role;


-- ── PASO 5: Recrear profiles faltantes para auth users sin profile ────────────
-- Llama a la función de migration 013 para crear los perfiles que falten
SELECT public.repair_orphaned_profiles();


-- ── PASO 6: Verificación final ───────────────────────────────────────────────
-- Esta consulta debe retornar 0 filas al terminar la migración.
-- Si retorna filas, hay usuarios sin perfil (revisar manualmente).
DO $$
DECLARE
  v_orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO v_orphan_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL;

  IF v_orphan_count > 0 THEN
    RAISE WARNING 'ATENCIÓN: quedan % usuario(s) sin perfil tras la migración', v_orphan_count;
  ELSE
    RAISE NOTICE 'OK: todos los usuarios de auth tienen su perfil en profiles';
  END IF;
END $$;
