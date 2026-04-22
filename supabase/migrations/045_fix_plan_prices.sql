-- =============================================================
-- 045: Corrección de precios en tabla plans
--
-- La migración 022 usó ON CONFLICT DO NOTHING, por lo que si los
-- planes ya existían con price = 0 (creados desde el admin),
-- los precios correctos nunca se aplicaron.
--
-- Precios en COP por mes:
--   Premium    mensual:    $9.900   semestral: $8.415   anual: $7.425
--   Enterprise mensual:   $49.900   semestral: $42.415  anual: $37.425
-- =============================================================

UPDATE public.plans
SET
  price_monthly_cop    = 9900,
  price_semiannual_cop = 8415,
  price_annual_cop     = 7425
WHERE code = 'premium';

UPDATE public.plans
SET
  price_monthly_cop    = 49900,
  price_semiannual_cop = 42415,
  price_annual_cop     = 37425
WHERE code = 'enterprise';

-- Verificación: mostrar precios resultantes
SELECT code, name, price_monthly_cop, price_semiannual_cop, price_annual_cop
FROM public.plans
ORDER BY price_monthly_cop;
