-- ============================================================================
-- FIX: Trigger handle_new_user más robusto
-- Problema: cedula_unica NOT NULL fallaba si el valor no llegaba en metadata
-- Solución: usar valor temporal si no se provee, y capturar excepciones
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, cedula_unica, cedula_tipo)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'cedula_unica', ''),
        'TEMP_' || NEW.id::text  -- placeholder hasta que el usuario lo complete
      ),
      COALESCE(NEW.raw_user_meta_data->>'cedula_tipo', 'CC')
    )
    ON CONFLICT (id) DO NOTHING;

    PERFORM create_default_categories(NEW.id);

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user falló para %: %', NEW.email, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
