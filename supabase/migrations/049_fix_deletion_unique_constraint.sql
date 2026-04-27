-- ============================================================
-- Migración 049: Corregir constraint único en account_deletion_requests
-- ============================================================
-- Bug: UNIQUE (user_id) sin condición bloquea nuevas solicitudes de baja
-- después de que el usuario cancela una solicitud previa.
--
-- cancel_account_deletion() hace UPDATE (marca cancelled_at), NO DELETE.
-- El registro "cancelado" queda en la tabla y ocupa el slot único de user_id,
-- impidiendo un INSERT posterior aunque la solicitud anterior ya no esté activa.
--
-- Solución: índice único PARCIAL — solo restringe filas activas.
-- ============================================================

-- 1. Eliminar el constraint absoluto (bloquea todos los estados)
ALTER TABLE account_deletion_requests
  DROP CONSTRAINT IF EXISTS uq_deletion_user;

-- 2. Crear índice único parcial: solo una solicitud ACTIVA por user_id
--    (activa = no cancelada y no ejecutada)
CREATE UNIQUE INDEX IF NOT EXISTS uq_deletion_user_active
  ON account_deletion_requests (user_id)
  WHERE cancelled_at IS NULL AND executed_at IS NULL;
