-- ============================================================================
-- MIGRACIÓN 022: Rediseño del sistema de pagos y suscripciones
--
-- Crea:
--   1. plans             — catálogo de planes (fuente de verdad de precios/límites)
--   2. payment_orders    — historial estructurado de cada pago
--   3. subscription_events — auditoría de cambios de estado en suscripciones
--
-- Modifica:
--   4. subscriptions     — agrega plan_id FK, status, elimina columnas redundantes
--   5. profiles          — plan_type pasa a ser derivado por trigger
--
-- Crea funciones/triggers:
--   6. sync_plan_from_subscription  — mantiene profiles.plan_type sincronizado
--   7. process_approved_payment     — versión actualizada (usa nuevas tablas)
--   8. process_failed_payment       — versión actualizada
-- ============================================================================

-- ============================================================================
-- 1. TABLA: plans (catálogo inmutable de planes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT UNIQUE NOT NULL,  -- 'free' | 'premium' | 'enterprise'
  name                  TEXT NOT NULL,
  storage_bytes         BIGINT NOT NULL,
  max_documents         INT,                   -- NULL = ilimitado
  max_file_size_mb      INT NOT NULL,
  price_monthly_cop     INT NOT NULL DEFAULT 0,
  price_semiannual_cop  INT NOT NULL DEFAULT 0, -- precio por mes al pagar semestral
  price_annual_cop      INT NOT NULL DEFAULT 0, -- precio por mes al pagar anual
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Datos iniciales de planes
INSERT INTO public.plans (code, name, storage_bytes, max_documents, max_file_size_mb,
                           price_monthly_cop, price_semiannual_cop, price_annual_cop)
VALUES
  ('free',       'Gratuito',    20971520,      15,   2,      0,     0,     0    ),
  ('premium',    'Premium',     524288000,     500,  10,     9900,  8415,  7425 ),
  ('enterprise', 'Empresarial', 5368709120,    NULL, 50,     49900, 42415, 37425)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. TABLA: payment_orders (historial estructurado de pagos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.profiles(id)      ON DELETE SET NULL,
  subscription_id     UUID,                                    -- FK se agrega después
  mp_payment_id       TEXT UNIQUE,                             -- ID de MercadoPago
  mp_preference_id    TEXT,
  gateway             TEXT NOT NULL DEFAULT 'mercadopago',
  amount_cop          NUMERIC(12,2) NOT NULL,
  billing_cycle       TEXT NOT NULL CHECK (billing_cycle IN ('monthly','semiannual','annual')),
  period_start        TIMESTAMPTZ,
  period_end          TIMESTAMPTZ,
  status              TEXT NOT NULL CHECK (status IN (
                        'pending','approved','rejected','cancelled','refunded','in_mediation'
                      )),
  payment_method_type TEXT,                                    -- 'card','pse','nequi','efecty'
  failure_reason      TEXT,
  raw_payload         JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id   ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status    ON public.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_mp_id     ON public.payment_orders(mp_payment_id);

-- ============================================================================
-- 3. MODIFICAR: subscriptions — agregar plan_id, status, quitar redundancias
-- ============================================================================

-- 3a. Agregar columnas nuevas
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id   UUID REFERENCES public.plans(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS status    TEXT CHECK (status IN (
                                       'trialing','active','past_due',
                                       'cancelled','expired','suspended'
                                     )),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- 3b. Poblar plan_id desde plan_type existente
UPDATE public.subscriptions s
SET plan_id = p.id
FROM public.plans p
WHERE p.code = s.plan_type
  AND s.plan_id IS NULL;

-- 3c. Poblar status desde is_active existente
UPDATE public.subscriptions
SET status = CASE
  WHEN is_active = TRUE  THEN 'active'
  WHEN cancelled_at IS NOT NULL THEN 'cancelled'
  ELSE 'expired'
END
WHERE status IS NULL;

-- 3d. Hacer columnas NOT NULL ahora que tienen datos
ALTER TABLE public.subscriptions
  ALTER COLUMN plan_id SET NOT NULL,
  ALTER COLUMN status  SET NOT NULL;

-- 3e. Agregar FK de payment_orders → subscriptions (ahora que subscriptions está lista)
ALTER TABLE public.payment_orders
  ADD CONSTRAINT fk_payment_orders_subscription
  FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. TABLA: subscription_events (historial de cambios de estado)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  payment_order_id UUID REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL CHECK (event_type IN (
                     'created','activated','renewed','expired',
                     'cancelled','suspended','plan_changed','reactivated'
                   )),
  old_status       TEXT,
  new_status       TEXT,
  old_plan_code    TEXT,
  new_plan_code    TEXT,
  triggered_by     TEXT NOT NULL CHECK (triggered_by IN ('webhook','cron','admin','user')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_subscription ON public.subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_type         ON public.subscription_events(event_type);

-- Registrar suscripciones existentes como evento 'created'
INSERT INTO public.subscription_events (subscription_id, event_type, new_status, new_plan_code, triggered_by, notes)
SELECT
  s.id,
  'created',
  s.status,
  p.code,
  'admin',
  'Migración 022 — registro inicial'
FROM public.subscriptions s
JOIN public.plans p ON p.id = s.plan_id
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. RLS en tablas nuevas
-- ============================================================================
ALTER TABLE public.plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- plans: todos pueden leer (es catálogo público)
CREATE POLICY "Planes visibles para todos" ON public.plans
  FOR SELECT USING (TRUE);

-- payment_orders: solo el dueño ve sus pagos
CREATE POLICY "Usuarios ven sus pagos" ON public.payment_orders
  FOR SELECT USING (auth.uid() = user_id);

-- subscription_events: solo el dueño de la suscripción
CREATE POLICY "Usuarios ven eventos de su suscripción" ON public.subscription_events
  FOR SELECT USING (
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. TRIGGER: sync_plan_from_subscription
--    Mantiene profiles.plan_type sincronizado con subscriptions.status + plan
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_plan_from_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_code TEXT;
BEGIN
  SELECT code INTO v_plan_code FROM public.plans WHERE id = NEW.plan_id;

  UPDATE public.profiles
  SET
    plan_type = CASE
      WHEN NEW.status IN ('active', 'trialing') THEN v_plan_code
      ELSE 'free'   -- expired / cancelled / suspended / past_due → free
    END,
    storage_quota_bytes = CASE
      WHEN NEW.status IN ('active', 'trialing') THEN
        (SELECT storage_bytes FROM public.plans WHERE id = NEW.plan_id)
      ELSE 20971520  -- 20 MB al volver a free
    END,
    updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_plan_from_subscription ON public.subscriptions;
CREATE TRIGGER trg_sync_plan_from_subscription
  AFTER INSERT OR UPDATE OF status, plan_id
  ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_plan_from_subscription();

-- ============================================================================
-- 7. FUNCIÓN ACTUALIZADA: process_approved_payment
--    Usa las nuevas tablas: payment_orders, subscription_events
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_approved_payment(
  p_user_id          UUID,
  p_transaction_id   TEXT,   -- mp_payment_id
  p_gateway          TEXT,
  p_plan_type        TEXT,   -- código del plan: 'premium' | 'enterprise'
  p_amount           NUMERIC,
  p_billing_cycle    TEXT,   -- 'monthly' | 'semiannual' | 'annual'
  p_payload          JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan            RECORD;
  v_period_end      TIMESTAMPTZ;
  v_billing_db      TEXT;
  v_sub_id          UUID;
  v_old_status      TEXT;
  v_old_plan_code   TEXT;
  v_payment_order_id UUID;
  v_mp_preference   TEXT;
BEGIN
  -- Obtener datos del plan
  SELECT id, code, storage_bytes INTO v_plan
  FROM public.plans WHERE code = p_plan_type;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'Plan no encontrado: %', p_plan_type;
  END IF;

  -- Calcular fin del período
  v_period_end := NOW() + CASE p_billing_cycle
    WHEN 'annual'     THEN INTERVAL '12 months'
    WHEN 'semiannual' THEN INTERVAL '6 months'
    ELSE                   INTERVAL '1 month'
  END;

  v_billing_db := CASE WHEN p_billing_cycle = 'monthly' THEN 'monthly' ELSE 'yearly' END;
  v_mp_preference := p_payload->>'preference_id';

  -- 1. Obtener estado anterior de la suscripción
  SELECT id, status, (SELECT code FROM plans WHERE id = s.plan_id)
  INTO v_sub_id, v_old_status, v_old_plan_code
  FROM public.subscriptions s WHERE user_id = p_user_id;

  -- 2. Crear o actualizar suscripción
  INSERT INTO public.subscriptions (
    user_id, plan_id, status, billing_cycle,
    current_period_start, current_period_end,
    is_active, updated_at
  ) VALUES (
    p_user_id, v_plan.id, 'active', v_billing_db,
    NOW(), v_period_end,
    TRUE, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id              = EXCLUDED.plan_id,
    status               = 'active',
    billing_cycle        = EXCLUDED.billing_cycle,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end   = EXCLUDED.current_period_end,
    is_active            = TRUE,
    cancelled_at         = NULL,
    cancellation_reason  = NULL,
    updated_at           = NOW()
  RETURNING id INTO v_sub_id;

  -- 3. Registrar pago en payment_orders
  INSERT INTO public.payment_orders (
    user_id, subscription_id, mp_payment_id, mp_preference_id,
    gateway, amount_cop, billing_cycle,
    period_start, period_end, status,
    payment_method_type, raw_payload, processed_at
  ) VALUES (
    p_user_id, v_sub_id, p_transaction_id, v_mp_preference,
    p_gateway, p_amount, p_billing_cycle,
    NOW(), v_period_end, 'approved',
    p_payload->>'payment_type_id', p_payload, NOW()
  )
  ON CONFLICT (mp_payment_id) DO NOTHING
  RETURNING id INTO v_payment_order_id;

  -- 4. Registrar evento de suscripción
  INSERT INTO public.subscription_events (
    subscription_id, payment_order_id, event_type,
    old_status, new_status, old_plan_code, new_plan_code,
    triggered_by
  ) VALUES (
    v_sub_id, v_payment_order_id,
    CASE WHEN v_old_status = 'active' AND v_old_plan_code = p_plan_type
         THEN 'renewed'
         WHEN v_old_plan_code IS DISTINCT FROM p_plan_type
         THEN 'plan_changed'
         ELSE 'activated'
    END,
    v_old_status, 'active',
    v_old_plan_code, v_plan.code,
    'webhook'
  );

  -- 5. Registrar en payment_webhooks (compatibilidad con tabla existente)
  INSERT INTO public.payment_webhooks (
    user_id, transaction_id, payment_gateway,
    amount, currency, status, plan_type,
    webhook_payload, processed_at
  ) VALUES (
    p_user_id, p_transaction_id, p_gateway,
    p_amount, 'COP', 'approved', p_plan_type,
    p_payload, NOW()
  )
  ON CONFLICT (transaction_id) DO NOTHING;

  -- 6. Audit log
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    p_user_id, 'PAYMENT_APPROVED', 'subscription', v_sub_id::TEXT,
    jsonb_build_object(
      'mp_payment_id', p_transaction_id,
      'gateway',       p_gateway,
      'plan',          p_plan_type,
      'amount_cop',    p_amount,
      'billing_cycle', p_billing_cycle
    )
  );
END;
$$;

-- ============================================================================
-- 8. FUNCIÓN ACTUALIZADA: process_failed_payment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_failed_payment(
  p_user_id        UUID,
  p_transaction_id TEXT,
  p_gateway        TEXT,
  p_amount         NUMERIC,
  p_payload        JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  -- Obtener subscription_id si hay usuario
  IF p_user_id IS NOT NULL THEN
    SELECT id INTO v_sub_id FROM public.subscriptions WHERE user_id = p_user_id;
  END IF;

  -- Registrar pago fallido en payment_orders
  INSERT INTO public.payment_orders (
    user_id, subscription_id, mp_payment_id,
    gateway, amount_cop, billing_cycle,
    status, raw_payload, processed_at
  ) VALUES (
    p_user_id, v_sub_id, p_transaction_id,
    p_gateway, p_amount, 'monthly',
    'rejected', p_payload, NOW()
  )
  ON CONFLICT (mp_payment_id) DO NOTHING;

  -- Compatibilidad con payment_webhooks
  INSERT INTO public.payment_webhooks (
    user_id, transaction_id, payment_gateway,
    amount, currency, status, webhook_payload, processed_at
  ) VALUES (
    p_user_id, p_transaction_id, p_gateway,
    p_amount, 'COP', 'failed', p_payload, NOW()
  )
  ON CONFLICT (transaction_id) DO NOTHING;

  -- Audit log
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      p_user_id, 'PAYMENT_FAILED', 'subscription', COALESCE(v_sub_id::TEXT, 'unknown'),
      jsonb_build_object(
        'mp_payment_id', p_transaction_id,
        'gateway',       p_gateway,
        'amount_cop',    p_amount
      )
    );
  END IF;
END;
$$;

-- ============================================================================
-- 9. FUNCIÓN: expire_subscriptions (para llamar desde cron)
--    Marca como 'expired' las suscripciones cuyo período venció
-- ============================================================================
CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE public.subscriptions
    SET status     = 'expired',
        is_active  = FALSE,
        updated_at = NOW()
    WHERE status = 'active'
      AND current_period_end < NOW()
    RETURNING id, user_id,
      (SELECT code FROM plans WHERE id = plan_id) AS plan_code
  ),
  events AS (
    INSERT INTO public.subscription_events (
      subscription_id, event_type, old_status, new_status,
      old_plan_code, triggered_by, notes
    )
    SELECT id, 'expired', 'active', 'expired', plan_code, 'cron', 'Período de pago vencido'
    FROM expired
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

-- Permisos
REVOKE EXECUTE ON FUNCTION public.process_approved_payment FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_failed_payment   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_subscriptions     FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.process_approved_payment TO service_role;
GRANT  EXECUTE ON FUNCTION public.process_failed_payment   TO service_role;
GRANT  EXECUTE ON FUNCTION public.expire_subscriptions     TO service_role;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
SELECT 'plans'               AS tabla, COUNT(*) FROM public.plans
UNION ALL
SELECT 'payment_orders',       COUNT(*) FROM public.payment_orders
UNION ALL
SELECT 'subscription_events',  COUNT(*) FROM public.subscription_events;
