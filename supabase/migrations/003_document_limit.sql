-- ============================================================================
-- LÍMITE DE DOCUMENTOS POR PLAN
-- ============================================================================

-- Tabla de límites por plan (fácil de ajustar sin tocar el código)
CREATE TABLE IF NOT EXISTS plan_limits (
  plan_type      TEXT PRIMARY KEY,
  max_documents  INTEGER,          -- NULL = ilimitado
  max_storage_bytes BIGINT NOT NULL
);

INSERT INTO plan_limits (plan_type, max_documents, max_storage_bytes) VALUES
  ('free',       10,   20971520),   -- 10 docs, 20MB
  ('premium',    500,  524288000),  -- 500 docs, 500MB
  ('enterprise', NULL, 5368709120) -- ilimitado, 5GB
ON CONFLICT (plan_type) DO UPDATE
  SET max_documents     = EXCLUDED.max_documents,
      max_storage_bytes = EXCLUDED.max_storage_bytes;

-- ============================================================================
-- FUNCIÓN: verificar límite de documentos antes de insertar
-- ============================================================================
CREATE OR REPLACE FUNCTION check_document_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_type      TEXT;
  v_max_documents  INTEGER;
  v_current_count  INTEGER;
BEGIN
  -- Obtener plan del usuario
  SELECT p.plan_type, pl.max_documents
  INTO v_plan_type, v_max_documents
  FROM profiles p
  JOIN plan_limits pl ON pl.plan_type = p.plan_type
  WHERE p.id = NEW.user_id;

  -- Si el plan no tiene límite (NULL), permitir siempre
  IF v_max_documents IS NULL THEN
    RETURN NEW;
  END IF;

  -- Contar documentos activos (no archivados) del usuario
  SELECT COUNT(*) INTO v_current_count
  FROM documents
  WHERE user_id = NEW.user_id
    AND is_archived = FALSE;

  IF v_current_count >= v_max_documents THEN
    RAISE EXCEPTION
      'Límite de documentos alcanzado. El plan % permite un máximo de % documentos activos.',
      v_plan_type, v_max_documents
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: se ejecuta antes de cada INSERT en documents
-- ============================================================================
CREATE TRIGGER trg_check_document_limit
BEFORE INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION check_document_limit();

-- ============================================================================
-- RLS en plan_limits: solo lectura pública (no hay datos sensibles)
-- ============================================================================
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden leer los límites de plan" ON plan_limits
  FOR SELECT
  USING (true);
