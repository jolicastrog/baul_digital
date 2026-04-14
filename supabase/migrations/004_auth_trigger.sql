-- ============================================================================
-- TRIGGER: crear perfil automáticamente cuando se registra un usuario
-- Se ejecuta en auth.users (contexto de servicio, sin restricciones RLS)
-- Los datos extra se pasan en options.data del signUp() del cliente
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, cedula_unica, cedula_tipo)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'cedula_unica',
    COALESCE(NEW.raw_user_meta_data->>'cedula_tipo', 'CC')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
