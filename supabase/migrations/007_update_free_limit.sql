-- Actualizar límite de documentos del plan gratuito: 10 → 15
UPDATE plan_limits
SET max_documents = 15
WHERE plan_type = 'free';
