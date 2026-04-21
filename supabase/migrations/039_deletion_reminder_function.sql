-- =============================================================
-- 039: get_deletion_reminder_candidates()
--
-- Retorna usuarios que solicitaron baja, cuyo scheduled_for está
-- entre 6 y 8 días desde ahora (ventana de ±1 día para el cron
-- diario), y que NO han recibido recordatorio para esta solicitud.
-- =============================================================

CREATE OR REPLACE FUNCTION get_deletion_reminder_candidates()
RETURNS TABLE (
  user_id        UUID,
  user_email     TEXT,
  full_name      TEXT,
  scheduled_for  TIMESTAMPTZ,
  days_remaining INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    adr.user_id,
    adr.user_email,
    p.full_name,
    adr.scheduled_for,
    EXTRACT(DAY FROM adr.scheduled_for - NOW())::INT AS days_remaining
  FROM  account_deletion_requests adr
  JOIN  profiles p ON p.id = adr.user_id
  WHERE adr.cancelled_at IS NULL
    AND adr.executed_at  IS NULL
    -- Ventana: entre 6 y 8 días antes de la eliminación
    AND adr.scheduled_for BETWEEN NOW() + INTERVAL '6 days'
                                AND NOW() + INTERVAL '8 days'
    -- No reenviar si ya se mandó recordatorio para esta solicitud
    AND NOT EXISTS (
      SELECT 1
      FROM   email_logs el
      WHERE  el.user_id  = adr.user_id
        AND  el.template = 'deletion_reminder'
        AND  el.sent_at  > adr.requested_at
    );
END;
$$;

REVOKE ALL ON FUNCTION get_deletion_reminder_candidates() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_deletion_reminder_candidates() TO service_role;
