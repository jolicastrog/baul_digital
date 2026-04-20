// == TYPES PRINCIPALES ==

export enum PlanType {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export enum CedulaType {
  CC = 'CC', // Cédula de Ciudadanía
  CE = 'CE', // Cédula de Extranjería
  PA = 'PA', // Pasaporte
  NIT = 'NIT', // Número de Identificación Tributaria
}

export enum DocumentAccessLevel {
  PRIVATE = 'private',
  FAMILY = 'family',
  TRUSTED = 'trusted',
}

export enum AlertStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DISMISSED = 'dismissed',
}

export enum PaymentGateway {
  MERCADOPAGO = 'mercadopago',
  BOLD        = 'bold',
}

export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// == INTERFACES ==

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  cedula_unica: string;
  cedula_tipo: CedulaType;
  plan_type: PlanType;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  two_factor_enabled: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  color_code: string;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  category_id: string | null;
  file_name: string;
  file_size_bytes: number;
  file_type: string;
  storage_path: string;
  description: string | null;
  expiry_date: string | null;
  tags: string[];
  is_starred: boolean;
  is_archived: boolean;
  access_level: DocumentAccessLevel;
  created_at: string;
  updated_at: string;
  last_accessed: string | null;
}

export interface Alert {
  id: string;
  user_id: string;
  document_id: string;
  document_name: string;
  expiry_date: string;
  alert_days_before: number;
  alert_sent: boolean;
  alert_sent_at: string | null;
  is_dismissed: boolean;
  dismissed_at: string | null;
  notify_email: boolean;
  notify_push: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
  storage_quota_bytes: number;
  billing_cycle: 'monthly' | 'yearly';
  current_period_start: string;
  current_period_end: string | null;
  is_active: boolean;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentWebhook {
  id: string;
  user_id: string | null;
  transaction_id: string;
  payment_gateway: PaymentGateway;
  amount: number;
  currency: string;
  status: PaymentStatus;
  plan_type: PlanType;
  webhook_payload: Record<string, any>;
  webhook_signature: string;
  created_at: string;
  processed_at: string | null;
}

export interface FraudDetection {
  id: string;
  cedula_unica: string;
  ip_address: string | null;
  fingerprint_hash: string | null;
  registration_attempts: number;
  last_attempt_at: string;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// == TIPOS PARA OPERACIONES ==

export interface UploadResult {
  success: boolean;
  document?: Document;
  error?: string;
  signedUrl?: string;
}

export interface StorageQuotaInfo {
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  percentage_used: number;
  plan_type: PlanType;
}

export interface FileCompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  useWebWorker?: boolean;
}

export interface DocumentUploadPayload {
  file: File;
  category_id?: string;
  description?: string;
  expiry_date?: Date;
  tags?: string[];
  access_level?: DocumentAccessLevel;
}

export interface MercadoPagoPreferenceRequest {
  planType: PlanType;
  billingCycle: 'monthly' | 'semiannual' | 'annual';
}

export interface MercadoPagoPreferenceResponse {
  preferenceId: string;
  initPoint: string;
}

export interface PlanDetails {
  plan_type: PlanType;
  storage_quota_bytes: number;
  max_file_size_mb: number;
  monthly_price_cop: number;
  yearly_price_cop: number;
  features: string[];
}

// == CONSTANTES DE TIPOS ==

export const PLAN_DETAILS: Record<PlanType, PlanDetails> = {
  [PlanType.FREE]: {
    plan_type: PlanType.FREE,
    storage_quota_bytes: 20 * 1024 * 1024,   // 20 MB — igual que plans.storage_bytes
    max_file_size_mb: 2,
    monthly_price_cop: 0,
    yearly_price_cop: 0,
    features: ['Almacenamiento cifrado', 'Categorías por defecto', 'Alertas de vencimiento'],
  },
  [PlanType.PREMIUM]: {
    plan_type: PlanType.PREMIUM,
    storage_quota_bytes: 500 * 1024 * 1024,  // 500 MB — igual que plans.storage_bytes
    max_file_size_mb: 10,
    monthly_price_cop: 9900,
    yearly_price_cop: 7425,
    features: [
      'Todo lo del plan gratuito',
      'Alertas por correo electrónico',
      'Categorías personalizadas ilimitadas',
      'Compartir documentos con familia',
      'Soporte prioritario',
    ],
  },
  [PlanType.ENTERPRISE]: {
    plan_type: PlanType.ENTERPRISE,
    storage_quota_bytes: 5 * 1024 * 1024 * 1024, // 5 GB — igual que plans.storage_bytes
    max_file_size_mb: 50,
    monthly_price_cop: 49900,
    yearly_price_cop: 37425,
    features: [
      'Todo lo del plan Premium',
      'Usuarios y roles ilimitados',
      'Panel de administrador',
      'Alertas por correo y SMS',
      'API de integración',
      'Soporte dedicado 24/7',
    ],
  },
};
