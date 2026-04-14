import { createClient } from '@supabase/supabase-js';
import { CedulaType } from '@/types';

// Inicializar cliente de Supabase con service role (solo para servidor)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================================
// TIPOS
// ============================================================================

export interface FraudCheckResult {
  isFraudulent: boolean;
  reasons: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface UserRegistrationData {
  email: string;
  cedula_unica: string;
  cedula_tipo: CedulaType;
  ip_address?: string;
  fingerprint?: string;
  user_agent?: string;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const MAX_REGISTRATION_ATTEMPTS_PER_IP_HOUR = 3;
const MAX_REGISTRATION_ATTEMPTS_PER_FINGERPRINT_HOUR = 2;
const MAX_REGISTRATION_ATTEMPTS_PER_CEDULA = 1; // No permitir registros duplicados

// ============================================================================
// VALIDACIÓN ANTI-FRAUDE
// ============================================================================

/**
 * Valida un numero de cédula (verificación básica)
 */
export function validateCedula(cedula: string, type: CedulaType): boolean {
  // Remover espacios y caracteres especiales
  const cleanedCedula = cedula.replace(/[^0-9]/g, '');

  // Validaciones básicas por tipo
  switch (type) {
    case CedulaType.CC:
      // Cédula de ciudadanía: 8-10 dígitos
      return cleanedCedula.length >= 8 && cleanedCedula.length <= 10 && /^\d+$/.test(cleanedCedula);

    case CedulaType.CE:
      // Cédula de extranjería: 1-10 caracteres
      return cedula.length >= 1 && cedula.length <= 10;

    case CedulaType.PA:
      // Pasaporte: 6-9 caracteres
      return cedula.length >= 6 && cedula.length <= 9;

    case CedulaType.NIT:
      // NIT: debe terminar en un dígito de verificación
      const nitClean = cedula.replace(/[^0-9-]/g, '').replace('-', '');
      return nitClean.length >= 8 && nitClean.length <= 12;

    default:
      return false;
  }
}

/**
 * Verifica si una cédula está registrada dos veces (violación de Ley 1581)
 */
export async function checkCedulaDuplicate(
  cedula_unica: string
): Promise<{ isDuplicate: boolean; existingUserId?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('cedula_unica', cedula_unica)
      .limit(1)
      .single();

    if (error?.code === 'PGRST116') {
      // No encontrado
      return { isDuplicate: false };
    }

    if (error) {
      console.error('Error checking cedula duplicate:', error);
      throw error;
    }

    return { isDuplicate: true, existingUserId: data?.id };
  } catch (error) {
    console.error('Error in checkCedulaDuplicate:', error);
    if (error instanceof Error && error.message.includes('PGRST116')) {
      return { isDuplicate: false };
    }
    throw error;
  }
}

/**
 * Verifica intentos de registro por IP
 */
export async function checkIPRegistrationAttempts(
  ip_address: string
): Promise<{ tooManyAttempts: boolean; attemptCount: number }> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count } = await supabaseAdmin
      .from('fraud_detection')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ip_address)
      .gt('last_attempt_at', oneHourAgo);

    const attemptCount = count || 0;
    const tooManyAttempts = attemptCount >= MAX_REGISTRATION_ATTEMPTS_PER_IP_HOUR;

    return { tooManyAttempts, attemptCount };
  } catch (error) {
    console.error('Error checking IP registration attempts:', error);
    return { tooManyAttempts: false, attemptCount: 0 };
  }
}

/**
 * Verifica intentos de registro por fingerprint del navegador
 */
export async function checkFingerprintRegistrationAttempts(
  fingerprint: string
): Promise<{ tooManyAttempts: boolean; attemptCount: number }> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count } = await supabaseAdmin
      .from('fraud_detection')
      .select('id', { count: 'exact', head: true })
      .eq('fingerprint_hash', fingerprint)
      .gt('last_attempt_at', oneHourAgo);

    const attemptCount = count || 0;
    const tooManyAttempts = attemptCount >= MAX_REGISTRATION_ATTEMPTS_PER_FINGERPRINT_HOUR;

    return { tooManyAttempts, attemptCount };
  } catch (error) {
    console.error('Error checking fingerprint registration attempts:', error);
    return { tooManyAttempts: false, attemptCount: 0 };
  }
}

/**
 * Realiza validación completa anti-fraude
 */
export async function performFraudCheck(
  userData: UserRegistrationData
): Promise<FraudCheckResult> {
  const reasons: string[] = [];
  let severity: FraudCheckResult['severity'] = 'low';

  // 1. Validar formato de cédula
  if (!validateCedula(userData.cedula_unica, userData.cedula_tipo)) {
    reasons.push(`Formato de ${userData.cedula_tipo} inválido`);
    severity = 'high';
  }

  // 2. Verificar duplicado de cédula
  const { isDuplicate } = await checkCedulaDuplicate(userData.cedula_unica);
  if (isDuplicate) {
    reasons.push('Este número de identificación ya está registrado');
    severity = 'high';
  }

  // 3. Verificar intentos de IP
  if (userData.ip_address) {
    const { tooManyAttempts: ipTooMany, attemptCount: ipCount } =
      await checkIPRegistrationAttempts(userData.ip_address);

    if (ipTooMany) {
      reasons.push(
        `Demasiados intentos de registro desde su IP (${ipCount} en la última hora)`
      );
      severity = severity === 'high' ? 'high' : 'medium';
    }
  }

  // 4. Verificar intentos de fingerprint
  if (userData.fingerprint) {
    const { tooManyAttempts: fpTooMany, attemptCount: fpCount } =
      await checkFingerprintRegistrationAttempts(userData.fingerprint);

    if (fpTooMany) {
      reasons.push(`Demasiados intentos de registro desde su navegador (${fpCount} en la última hora)`);
      severity = severity === 'high' ? 'high' : 'medium';
    }
  }

  return {
    isFraudulent: reasons.length > 0,
    reasons,
    severity,
  };
}

/**
 * Registra un intento de registro (exitoso o no)
 */
export async function recordRegistrationAttempt(
  cedula_unica: string,
  ip_address?: string,
  fingerprint_hash?: string,
  flagged: boolean = false,
  flagReason?: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from('fraud_detection').upsert(
      {
        cedula_unica,
        ip_address: ip_address || null,
        fingerprint_hash: fingerprint_hash || null,
        registration_attempts: flagged ? 1 : 1,
        last_attempt_at: new Date().toISOString(),
        is_flagged: flagged,
        flag_reason: flagReason || null,
      },
      { onConflict: 'cedula_unica' }
    );

    if (error) {
      console.error('Error recording registration attempt:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in recordRegistrationAttempt:', error);
    return false;
  }
}

/**
 * Marca una cédula como sospechosa/fraudulenta
 */
export async function flagAsFraudulent(
  cedula_unica: string,
  reason: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('fraud_detection')
      .update({
        is_flagged: true,
        flag_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('cedula_unica', cedula_unica);

    if (error) {
      console.error('Error flagging as fraudulent:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in flagAsFraudulent:', error);
    return false;
  }
}

/**
 * Obtiene información de detección de fraude para una cédula
 */
export async function getFraudDetectionInfo(cedula_unica: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('fraud_detection')
      .select('*')
      .eq('cedula_unica', cedula_unica)
      .single();

    if (error?.code === 'PGRST116') {
      return null;
    }

    if (error) {
      console.error('Error getting fraud detection info:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getFraudDetectionInfo:', error);
    return null;
  }
}
