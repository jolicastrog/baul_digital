-- =============================================================
-- 044: Función get_payment_history
--
-- Devuelve el historial de pagos de un usuario con join a plans.
-- Parametrizable por rango de fechas (p_from / p_to opcionales).
-- Solo devuelve registros del propio usuario (p_user_id).
-- Accesible por el rol authenticated (cada usuario ve solo los suyos).
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_payment_history(
  p_user_id UUID,
  p_from    DATE DEFAULT NULL,
  p_to      DATE DEFAULT NULL
)
RETURNS TABLE (
  order_id       UUID,
  plan_name      TEXT,
  billing_cycle  TEXT,
  amount_cop     NUMERIC,
  payment_method TEXT,
  status         TEXT,
  period_start   TIMESTAMPTZ,
  period_end     TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  transaction_id TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    po.id,
    COALESCE(pl.name, 'Plan desconocido')          AS plan_name,
    po.billing_cycle,
    po.amount_cop,
    po.payment_method_type                          AS payment_method,
    po.status,
    po.period_start,
    po.period_end,
    COALESCE(po.processed_at, po.created_at)        AS paid_at,
    po.mp_payment_id                                AS transaction_id
  FROM  public.payment_orders     po
  LEFT  JOIN public.subscriptions s   ON s.id  = po.subscription_id
  LEFT  JOIN public.plans         pl  ON pl.id = s.plan_id
  WHERE po.user_id = p_user_id
    AND (p_from IS NULL OR po.created_at::DATE >= p_from)
    AND (p_to   IS NULL OR po.created_at::DATE <= p_to)
  ORDER BY po.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_payment_history(UUID, DATE, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_payment_history(UUID, DATE, DATE) TO authenticated;
