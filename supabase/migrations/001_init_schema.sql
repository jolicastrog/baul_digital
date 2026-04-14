-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (Usuarios y metadatos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  cedula_unica TEXT UNIQUE NOT NULL,
  cedula_tipo TEXT CHECK (cedula_tipo IN ('CC', 'CE', 'PA', 'NIT')),
  
  -- Suscripción
  plan_type TEXT CHECK (plan_type IN ('free', 'premium', 'enterprise')) DEFAULT 'free',
  storage_quota_bytes BIGINT DEFAULT 20971520, -- 20MB para free
  storage_used_bytes BIGINT DEFAULT 0,
  
  -- Metadata
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  
  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  CONSTRAINT storage_used_valid CHECK (storage_used_bytes <= storage_quota_bytes)
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_cedula ON profiles(cedula_unica);
CREATE INDEX idx_profiles_plan_type ON profiles(plan_type);

-- ============================================================================
-- 2. CATEGORIES TABLE (Categorías de documentos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Nombre del ícono de Lucide
  color_code TEXT DEFAULT '#1e40af',
  sort_order INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_archived ON categories(is_archived);

-- ============================================================================
-- 3. DOCUMENTS TABLE (Documentos del usuario)
-- ============================================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  
  -- Información del archivo
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  file_type TEXT NOT NULL, -- MIME type: application/pdf, image/jpeg, etc.
  storage_path TEXT NOT NULL UNIQUE, -- user_id/{categoria}/{uuid}.pdf
  
  -- Metadata
  description TEXT,
  expiry_date DATE, -- Para documentos que vencen
  tags TEXT ARRAY DEFAULT ARRAY[]::TEXT[],
  
  -- Seguridad
  is_starred BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  access_level TEXT CHECK (access_level IN ('private', 'family', 'trusted')) DEFAULT 'private',
  
  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_category_id ON documents(category_id);
CREATE INDEX idx_documents_expiry_date ON documents(expiry_date);
CREATE INDEX idx_documents_archived ON documents(is_archived);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);

-- ============================================================================
-- 4. SUBSCRIPTIONS TABLE (Planes y pagos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Plan actual
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'premium', 'enterprise')),
  storage_quota_bytes BIGINT NOT NULL,
  
  -- Periodo de pago
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE,
  
  -- Cancelación
  is_active BOOLEAN DEFAULT TRUE,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_plan_type ON subscriptions(plan_type);
CREATE INDEX idx_subscriptions_active ON subscriptions(is_active);

-- ============================================================================
-- 5. ALERTS TABLE (Alertas de vencimiento)
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Configuración
  document_name TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  alert_days_before INTEGER DEFAULT 30,
  
  -- Estado
  alert_sent BOOLEAN DEFAULT FALSE,
  alert_sent_at TIMESTAMP WITH TIME ZONE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  
  -- Notificaciones
  notify_email BOOLEAN DEFAULT TRUE,
  notify_push BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_document_id ON alerts(document_id);
CREATE INDEX idx_alerts_expiry_date ON alerts(expiry_date);
CREATE INDEX idx_alerts_alert_sent ON alerts(alert_sent);
CREATE INDEX idx_alerts_dismissed ON alerts(is_dismissed);

-- ============================================================================
-- 6. PAYMENT_WEBHOOKS TABLE (Registro de webhooks de pago)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Información de pago
  transaction_id TEXT UNIQUE NOT NULL,
  payment_gateway TEXT NOT NULL, -- 'wompi' | 'epayco'
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'COP',
  
  -- Estado
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'failed', 'refunded')),
  plan_type TEXT CHECK (plan_type IN ('premium', 'enterprise')),
  
  -- Datos del webhook
  webhook_payload JSONB,
  webhook_signature TEXT,
  
  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_payment_webhooks_user_id ON payment_webhooks(user_id);
CREATE INDEX idx_payment_webhooks_status ON payment_webhooks(status);
CREATE INDEX idx_payment_webhooks_transaction_id ON payment_webhooks(transaction_id);

-- ============================================================================
-- 7. FRAUD_DETECTION TABLE (Detección de fraude)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fraud_detection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identidad
  cedula_unica TEXT NOT NULL,
  ip_address INET,
  fingerprint_hash TEXT,
  
  -- Intentos de registro
  registration_attempts INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Estado
  is_flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cedula_unica)
);

CREATE INDEX idx_fraud_ip_address ON fraud_detection(ip_address);
CREATE INDEX idx_fraud_fingerprint ON fraud_detection(fingerprint_hash);
CREATE INDEX idx_fraud_flagged ON fraud_detection(is_flagged);

-- ============================================================================
-- 8. AUDIT_LOGS TABLE (Logs de auditoría)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Acción
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL, -- 'document', 'profile', 'subscription'
  resource_id UUID,
  
  -- Detalles
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- FUNCIONES DE UTILIDAD
-- ============================================================================

-- Función para verificar cuota de almacenamiento
CREATE OR REPLACE FUNCTION check_storage_quota(p_user_id UUID, p_file_size_bytes BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  v_storage_used BIGINT;
  v_storage_quota BIGINT;
BEGIN
  SELECT storage_used_bytes, storage_quota_bytes INTO v_storage_used, v_storage_quota
  FROM profiles
  WHERE id = p_user_id;
  
  RETURN (v_storage_used + p_file_size_bytes) <= v_storage_quota;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para incrementar storage usado
CREATE OR REPLACE FUNCTION update_storage_used(p_user_id UUID, p_file_size_bytes BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET storage_used_bytes = storage_used_bytes + p_file_size_bytes,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para decrementar storage usado
CREATE OR REPLACE FUNCTION free_storage(p_user_id UUID, p_file_size_bytes BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET storage_used_bytes = GREATEST(0, storage_used_bytes - p_file_size_bytes),
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para crear una alerta cuando se sube un documento con fecha de vencimiento
CREATE OR REPLACE FUNCTION create_expiry_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL THEN
    INSERT INTO alerts (user_id, document_id, document_name, expiry_date, alert_days_before)
    VALUES (NEW.user_id, NEW.id, NEW.file_name, NEW.expiry_date, 30);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear alertas automáticamente
CREATE TRIGGER trg_create_alert_on_document_insert
AFTER INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION create_expiry_alert();

-- Función para actualizar timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para actualizar updated_at
CREATE TRIGGER trg_update_profiles_timestamp
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_update_documents_timestamp
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_update_categories_timestamp
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_detection ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- === PROFILES RLS ===
-- Los usuarios solo pueden leer su propio perfil
CREATE POLICY "Usuarios leen su propio perfil" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Usuarios actualizan su propio perfil" ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- ADMIN puede leer perfiles (pero no verá archivos físicos por política de storage)
CREATE POLICY "ADMIN puede leer profiles" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND cedula_unica IS NOT NULL
      AND plan_type = 'enterprise'
    )
  );

-- === CATEGORIES RLS ===
-- Los usuarios solo ven sus propias categorías
CREATE POLICY "Usuarios ven su propias categorías" ON categories
  FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios pueden crear categorías
CREATE POLICY "Usuarios crean categorías" ON categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar/eliminar sus propias categorías
CREATE POLICY "Usuarios actualizan sus categorías" ON categories
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus categorías" ON categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- === DOCUMENTS RLS ===
-- Los usuarios solo ven sus propios documentos
CREATE POLICY "Usuarios ven sus documentos" ON documents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios pueden crear documentos
CREATE POLICY "Usuarios crean documentos" ON documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar/eliminar sus propios documentos
CREATE POLICY "Usuarios actualizan sus documentos" ON documents
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus documentos" ON documents
  FOR DELETE
  USING (auth.uid() = user_id);

-- === SUBSCRIPTIONS RLS ===
CREATE POLICY "Usuarios ven su suscripción" ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan su suscripción" ON subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- === ALERTS RLS ===
CREATE POLICY "Usuarios ven sus alertas" ON alerts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus alertas" ON alerts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- === PAYMENT_WEBHOOKS RLS ===
-- Los usuarios pueden ver sus webhooks (transacciones)
CREATE POLICY "Usuarios ven sus webhooks" ON payment_webhooks
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- === AUDIT_LOGS RLS ===
-- Los usuarios solo ven sus propios logs
CREATE POLICY "Usuarios ven sus logs" ON audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- === FRAUD_DETECTION RLS ===
-- Solo ADMIN puede ver registros de fraude
CREATE POLICY "Solo ADMIN ve fraud_detection" ON fraud_detection
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND plan_type = 'enterprise'
    )
  );
