-- Migración 051: Cola de recordatorios de vencimiento de documentos
-- Tabla: document_expiry_emails
-- Funciones: schedule_expiry_emails_for_document, backfill_expiry_reminders_for_rule
-- Triggers: en documents (insert/update) y en expiry_reminder_rules (insert/update)

-- ── Tabla principal ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_expiry_emails (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID        NOT NULL REFERENCES documents(id)            ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES profiles(id)             ON DELETE CASCADE,
  rule_id        UUID        REFERENCES expiry_reminder_rules(id)         ON DELETE SET NULL,
  days_before    INT         NOT NULL CHECK (days_before > 0),
  scheduled_date DATE        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','sent','failed','skipped','cancelled')),
  sent_at        TIMESTAMPTZ,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, days_before)
);

-- Índice parcial para el cron (solo filas pendientes)
CREATE INDEX IF NOT EXISTS idx_dee_scheduled_pending
  ON document_expiry_emails (scheduled_date)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dee_document_id ON document_expiry_emails (document_id);
CREATE INDEX IF NOT EXISTS idx_dee_user_id     ON document_expiry_emails (user_id);
CREATE INDEX IF NOT EXISTS idx_dee_status      ON document_expiry_emails (status);

ALTER TABLE document_expiry_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON document_expiry_emails
  USING (false)
  WITH CHECK (false);

-- ── Función compartida: programar envíos para un documento ────────────────────
CREATE OR REPLACE FUNCTION schedule_expiry_emails_for_document(
  p_document_id UUID,
  p_expiry_date DATE,
  p_user_id     UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rule       RECORD;
  v_sched_date DATE;
BEGIN
  FOR v_rule IN
    SELECT id, days_before FROM expiry_reminder_rules WHERE is_active = TRUE
  LOOP
    v_sched_date := p_expiry_date - v_rule.days_before;
    IF v_sched_date >= CURRENT_DATE THEN
      INSERT INTO document_expiry_emails
        (document_id, user_id, rule_id, days_before, scheduled_date)
      VALUES
        (p_document_id, p_user_id, v_rule.id, v_rule.days_before, v_sched_date)
      ON CONFLICT (document_id, days_before) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- ── Función de backfill: documentos existentes al activar una regla ───────────
CREATE OR REPLACE FUNCTION backfill_expiry_reminders_for_rule(
  p_days_before INT,
  p_rule_id     UUID
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO document_expiry_emails
    (document_id, user_id, rule_id, days_before, scheduled_date)
  SELECT
    d.id,
    d.user_id,
    p_rule_id,
    p_days_before,
    d.expiry_date - p_days_before
  FROM documents d
  JOIN profiles p ON p.id = d.user_id
  WHERE d.expiry_date IS NOT NULL
    AND d.expiry_date > CURRENT_DATE
    AND d.expiry_date - p_days_before >= CURRENT_DATE
    AND p.plan_type IN ('premium', 'enterprise')
  ON CONFLICT (document_id, days_before) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── Trigger 1: Documento nuevo con fecha de vencimiento ───────────────────────
CREATE OR REPLACE FUNCTION trg_fn_document_insert_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL THEN
    PERFORM schedule_expiry_emails_for_document(NEW.id, NEW.expiry_date, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_insert_expiry ON documents;
CREATE TRIGGER trg_document_insert_expiry
AFTER INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION trg_fn_document_insert_expiry();

-- ── Trigger 2: Fecha de vencimiento cambiada o eliminada ──────────────────────
CREATE OR REPLACE FUNCTION trg_fn_document_update_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Cancelar todos los pendientes del documento
  UPDATE document_expiry_emails
    SET status = 'cancelled'
  WHERE document_id = NEW.id AND status = 'pending';

  -- Si la nueva fecha no es null, recalcular
  IF NEW.expiry_date IS NOT NULL THEN
    PERFORM schedule_expiry_emails_for_document(NEW.id, NEW.expiry_date, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_update_expiry ON documents;
CREATE TRIGGER trg_document_update_expiry
AFTER UPDATE ON documents
FOR EACH ROW
WHEN (OLD.expiry_date IS DISTINCT FROM NEW.expiry_date)
EXECUTE FUNCTION trg_fn_document_update_expiry();

-- ── Trigger 3: Regla desactivada/activada → cancelar o backfill ───────────────
CREATE OR REPLACE FUNCTION trg_fn_rule_changed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Regla pasó de activa a inactiva → cancelar sus pendientes
  IF TG_OP = 'UPDATE' AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    UPDATE document_expiry_emails
      SET status = 'cancelled'
    WHERE days_before = NEW.days_before AND status = 'pending';
  END IF;

  -- Regla reactivada o nueva con is_active = TRUE → backfill
  IF (TG_OP = 'UPDATE' AND OLD.is_active = FALSE AND NEW.is_active = TRUE)
     OR (TG_OP = 'INSERT' AND NEW.is_active = TRUE) THEN
    PERFORM backfill_expiry_reminders_for_rule(NEW.days_before, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rule_changed ON expiry_reminder_rules;
CREATE TRIGGER trg_rule_changed
AFTER INSERT OR UPDATE ON expiry_reminder_rules
FOR EACH ROW
EXECUTE FUNCTION trg_fn_rule_changed();
