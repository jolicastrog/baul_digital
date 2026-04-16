-- ============================================================================
-- MIGRACIÓN 008: Dividir full_name en nombres + apellidos
--               y ampliar tipos de documento
-- ============================================================================

-- ── 1. Agregar columnas nombres y apellidos ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS nombres   VARCHAR(60),
  ADD COLUMN IF NOT EXISTS apellidos VARCHAR(60);

-- ── 2. Migrar data existente de full_name ────────────────────────────────────
-- Toma la primera palabra como nombres y el resto como apellidos
UPDATE profiles
SET
  nombres = CASE
    WHEN full_name IS NOT NULL AND trim(full_name) <> ''
    THEN split_part(trim(full_name), ' ', 1)
    ELSE NULL
  END,
  apellidos = CASE
    WHEN full_name IS NOT NULL
      AND length(trim(full_name)) > length(split_part(trim(full_name), ' ', 1))
    THEN trim(substring(trim(full_name) FROM length(split_part(trim(full_name), ' ', 1)) + 2))
    ELSE NULL
  END
WHERE full_name IS NOT NULL;

-- ── 3. Trigger para mantener full_name sincronizado automáticamente ──────────
CREATE OR REPLACE FUNCTION sync_full_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name := trim(
    COALESCE(NEW.nombres, '') ||
    CASE
      WHEN NEW.apellidos IS NOT NULL AND trim(NEW.apellidos) <> ''
      THEN ' ' || trim(NEW.apellidos)
      ELSE ''
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_full_name ON profiles;
CREATE TRIGGER trg_sync_full_name
  BEFORE INSERT OR UPDATE OF nombres, apellidos
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_full_name();

-- ── 4. Actualizar tipos de documento permitidos ──────────────────────────────
-- Primero eliminar el constraint existente
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_cedula_tipo_check;

-- Agregar constraint ampliado con todos los tipos colombianos relevantes
ALTER TABLE profiles
  ADD CONSTRAINT profiles_cedula_tipo_check
  CHECK (cedula_tipo IN (
    'CC',   -- Cédula de Ciudadanía
    'TI',   -- Tarjeta de Identidad (menores 14-17 años)
    'RC',   -- Registro Civil (menores de 14 años)
    'CE',   -- Cédula de Extranjería
    'PA',   -- Pasaporte
    'NIT',  -- NIT Empresarial
    'PEP',  -- Permiso Especial de Permanencia
    'PPT'   -- Permiso de Protección Temporal
  ));

-- ── 5. Actualizar trigger handle_new_user para leer nombres/apellidos ─────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      id, email, nombres, apellidos, full_name,
      cedula_unica, cedula_tipo
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'nombres',   ''), NULL),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'apellidos', ''), NULL),
      -- full_name: usa nombres+apellidos si están, si no usa full_name legacy
      COALESCE(
        NULLIF(
          trim(
            COALESCE(NULLIF(NEW.raw_user_meta_data->>'nombres', ''),   '') ||
            CASE
              WHEN COALESCE(NEW.raw_user_meta_data->>'apellidos', '') <> ''
              THEN ' ' || NEW.raw_user_meta_data->>'apellidos'
              ELSE ''
            END
          ),
          ''
        ),
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
      ),
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'cedula_unica', ''),
        'TEMP_' || NEW.id::text
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
