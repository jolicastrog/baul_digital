-- =============================================================
-- 042: Función auxiliar para detectar emails existentes pero
--      no confirmados (usada por el flujo de registro).
--
-- Permite al API de registro diferenciar entre "email ya
-- confirmado (=cuenta activa)" vs "email registrado pero
-- pendiente de confirmación", para mostrar un mensaje claro
-- y ofrecer reenviar el enlace de confirmación.
-- =============================================================

CREATE OR REPLACE FUNCTION public.check_unconfirmed_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE  email              = lower(trim(p_email))
      AND  email_confirmed_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.check_unconfirmed_email(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_unconfirmed_email(TEXT) TO service_role;
