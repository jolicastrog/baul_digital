-- ============================================================================
-- Categorías por defecto para nuevos usuarios
-- Se crea automáticamente cuando se registra un usuario
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_categories(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, icon, color_code, sort_order)
  VALUES
    (p_user_id, 'Identidad',       'fingerprint',  '#1e40af', 1),
    (p_user_id, 'Salud',           'heart-pulse',  '#dc2626', 2),
    (p_user_id, 'Educación',       'graduation-cap','#7c3aed', 3),
    (p_user_id, 'Financiero',      'banknote',     '#059669', 4),
    (p_user_id, 'Propiedad',       'home',         '#d97706', 5),
    (p_user_id, 'Otros',           'folder',       '#475569', 6)
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar trigger handle_new_user para incluir categorías por defecto
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

  PERFORM create_default_categories(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
