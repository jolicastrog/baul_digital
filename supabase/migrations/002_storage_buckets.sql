-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Bucket para documentos privados de usuarios (privado)
-- Estructura de path: {user_id}/{categoria}/{uuid}.ext
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50MB por archivo
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Bucket para avatares de usuarios (público)
-- Estructura de path: {user_id}/avatar.ext
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB por archivo
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE RLS POLICIES - DOCUMENTS BUCKET
-- ============================================================================

-- Los usuarios solo pueden ver archivos en su propia carpeta
CREATE POLICY "Usuarios ven sus documentos en storage" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Los usuarios solo pueden subir a su propia carpeta
CREATE POLICY "Usuarios suben sus documentos" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Los usuarios solo pueden actualizar archivos de su carpeta
CREATE POLICY "Usuarios actualizan sus documentos en storage" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Los usuarios solo pueden eliminar archivos de su carpeta
CREATE POLICY "Usuarios eliminan sus documentos en storage" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- STORAGE RLS POLICIES - AVATARS BUCKET
-- ============================================================================

-- Cualquiera puede ver avatares (bucket público)
CREATE POLICY "Avatares son públicos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- Los usuarios solo pueden subir su propio avatar
CREATE POLICY "Usuarios suben su avatar" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Los usuarios solo pueden actualizar su propio avatar
CREATE POLICY "Usuarios actualizan su avatar" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Los usuarios solo pueden eliminar su propio avatar
CREATE POLICY "Usuarios eliminan su avatar" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
