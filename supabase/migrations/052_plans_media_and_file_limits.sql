-- Migración 052: Agregar allow_media_files a plans + actualizar max_file_size_mb
--
-- Nuevos límites de tamaño de archivo por subida:
--   free       →  10 MB
--   premium    →  50 MB
--   enterprise → 200 MB
--
-- Nueva columna allow_media_files:
--   free       → FALSE (solo documentos e imágenes)
--   premium    → TRUE  (+ MP3 y MP4 cortos)
--   enterprise → TRUE  (+ MP3 y MP4 cortos)

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS allow_media_files BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE plans SET max_file_size_mb = 10,  allow_media_files = FALSE WHERE code = 'free';
UPDATE plans SET max_file_size_mb = 50,  allow_media_files = TRUE  WHERE code = 'premium';
UPDATE plans SET max_file_size_mb = 200, allow_media_files = TRUE  WHERE code = 'enterprise';
