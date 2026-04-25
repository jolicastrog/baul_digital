-- ============================================================================
-- 047: Corregir tabla subscription_events para soportar cancelaciones
--
-- La función cancel_subscription (migración 034) inserta:
--   - event_type = 'cancellation_requested'  → no estaba en el CHECK constraint
--   - details JSONB                          → columna no existía (tabla tiene 'notes TEXT')
--
-- Solución:
--   1. Agregar columna details JSONB a subscription_events
--   2. Ampliar el CHECK constraint de event_type
-- ============================================================================

-- 1. Agregar columna details JSONB (nullable, compatible con registros existentes)
ALTER TABLE public.subscription_events
  ADD COLUMN IF NOT EXISTS details JSONB;

-- 2. Reemplazar el CHECK constraint de event_type para incluir 'cancellation_requested'
ALTER TABLE public.subscription_events
  DROP CONSTRAINT IF EXISTS subscription_events_event_type_check;

ALTER TABLE public.subscription_events
  ADD CONSTRAINT subscription_events_event_type_check
  CHECK (event_type IN (
    'created',
    'activated',
    'renewed',
    'expired',
    'cancelled',
    'suspended',
    'plan_changed',
    'reactivated',
    'cancellation_requested'
  ));

-- Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'subscription_events'
ORDER BY ordinal_position;
