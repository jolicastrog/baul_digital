-- Política de retención selectiva para audit_logs
-- Eventos críticos (pagos, cancelaciones, cierres): 5 años
-- Eventos operativos (uploads, perfil): 1 año
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS retain_until TIMESTAMPTZ;

-- Poblar retain_until en registros existentes según criticidad
UPDATE audit_logs
SET retain_until = created_at + INTERVAL '5 years'
WHERE action IN (
  'PAYMENT_APPROVED',
  'PAYMENT_FAILED',
  'SUBSCRIPTION_CANCELLATION_REQUESTED',
  'ACCOUNT_DELETION_REQUESTED',
  'ACCOUNT_DELETION_CANCELLED',
  'ACCOUNT_DELETION_CANCELLED_BY_ADMIN',
  'ACCOUNT_DELETION_EXECUTED',
  'DOCUMENT_EXPORT_REQUESTED',
  'ARCHIVE_PURGED'
);

UPDATE audit_logs
SET retain_until = created_at + INTERVAL '1 year'
WHERE retain_until IS NULL;

-- Índice para que el cron de purga sea eficiente
CREATE INDEX IF NOT EXISTS idx_audit_logs_retain_until ON audit_logs (retain_until);

-- Función de purga: elimina logs vencidos (llamada por cron anual)
CREATE OR REPLACE FUNCTION purge_expired_audit_logs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM audit_logs WHERE retain_until <= NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Registrar la purga sin fecha de expiración (evento de sistema)
  INSERT INTO audit_logs (action, resource_type, details, retain_until)
  VALUES (
    'AUDIT_LOGS_PURGED',
    'system',
    jsonb_build_object('records_deleted', v_count),
    NOW() + INTERVAL '5 years'
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION purge_expired_audit_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_audit_logs() TO service_role;
