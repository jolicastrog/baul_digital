-- ============================================================================
-- MIGRACIÓN 015: FK profiles → auth.users DEFERRABLE INITIALLY DEFERRED
--
-- Problema raíz confirmado:
--   El FK fk_profiles_auth_user fue creado como IMMEDIATE (no deferrable).
--   Cuando el trigger handle_new_user intenta insertar en profiles DENTRO
--   de la misma transacción donde se inserta el auth user, el FK check
--   inmediato no puede ver la fila recién insertada en auth.users (aún no
--   está committed desde la perspectiva del FK), y falla con
--   foreign_key_violation. El EXCEPTION del trigger lo captura
--   silenciosamente → perfil no se crea.
--
-- Solución:
--   Convertir el FK a DEFERRABLE INITIALLY DEFERRED: el check se pospone
--   al final de la transacción (COMMIT). Para entonces, el auth user ya
--   existe y el check pasa. El ON DELETE CASCADE se mantiene igual.
-- ============================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS fk_profiles_auth_user;

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_auth_user
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- Verificación: debe mostrar condeferrable=true, condeferred=true
SELECT conname, condeferrable, condeferred, confdeltype
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname = 'fk_profiles_auth_user';
