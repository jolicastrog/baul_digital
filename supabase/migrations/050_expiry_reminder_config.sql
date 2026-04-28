-- Migración 050: Tablas de configuración para recordatorios de vencimiento
-- expiry_reminder_settings: interruptor global (singleton)
-- expiry_reminder_rules: reglas configurables (días antes del vencimiento)

-- ── Tabla de configuración global ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expiry_reminder_settings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reminders_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID        REFERENCES profiles(id) ON DELETE SET NULL
);

-- Solo puede existir una fila (singleton)
INSERT INTO expiry_reminder_settings (reminders_enabled)
VALUES (TRUE);

ALTER TABLE expiry_reminder_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON expiry_reminder_settings
  USING (false)
  WITH CHECK (false);

-- ── Tabla de reglas configurables ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expiry_reminder_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  days_before INT         NOT NULL CHECK (days_before > 0),
  label       TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (days_before)
);

-- Reglas iniciales
INSERT INTO expiry_reminder_rules (days_before, label, is_active, sort_order) VALUES
  (30, '30 días antes', TRUE, 1),
  (8,  '8 días antes',  TRUE, 2),
  (1,  '1 día antes',   TRUE, 3);

ALTER TABLE expiry_reminder_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON expiry_reminder_rules
  USING (false)
  WITH CHECK (false);
