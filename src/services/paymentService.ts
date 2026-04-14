import { createClient } from '@supabase/supabase-js';
import { PaymentGateway, PaymentStatus, PlanType } from '@/types';
import crypto from 'crypto';

// Inicializar cliente de Supabase con service role (solo para servidor)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================================
// TIPOS
// ============================================================================

export interface WompiPaymentNotification {
  event: string;
  data: {
    transaction: {
      id: string;
      reference: string;
      amount_in_cents: number;
      currency: string;
      status: string;
      customer_email: string;
      timestamp: string;
    };
  };
}

export interface EPaycoPaymentNotification {
  x_transaction_id: string;
  x_ref_payco: string;
  x_amount: string;
  x_currency: string;
  x_response: string;
  x_response_description: string;
  x_transaction_date: string;
  x_customer_email: string;
  x_signature: string;
}

// ============================================================================
// UTILIDADES DE VALIDACIÓN
// ============================================================================

/**
 * Valida la firma de Wompi
 */
export function validateWompiSignature(payload: string, signature: string): boolean {
  const secret = process.env.WOMPI_WEBHOOK_SECRET || '';
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

/**
 * Valida la firma de ePayco
 */
export function validateEPaycoSignature(params: Record<string, string>): boolean {
  const secret = process.env.EPAYCO_WEBHOOK_SECRET || '';

  // Orden específico de parámetros para ePayco
  const signatureString = [
    params.x_transaction_id,
    params.x_ref_payco,
    params.x_amount,
    params.x_currency,
    params.x_response,
    secret,
  ].join('^');

  const expectedSignature = crypto.createHmac('sha256', secret).update(signatureString).digest('hex');
  return params.x_signature === expectedSignature;
}

// ============================================================================
// MANEJO DE PAGOS
// ============================================================================

/**
 * Mapea el plan del producto al tipo de suscripción
 */
function mapProductToPlanType(productId: string): PlanType {
  const productMap: Record<string, PlanType> = {
    'premium-monthly': PlanType.PREMIUM,
    'premium-yearly': PlanType.PREMIUM,
    'enterprise-monthly': PlanType.ENTERPRISE,
    'enterprise-yearly': PlanType.ENTERPRISE,
  };
  return productMap[productId] || PlanType.FREE;
}

/**
 * Obtiene la cuota de almacenamiento por plan
 */
function getStorageQuotaByPlan(planType: PlanType): number {
  const quotas: Record<PlanType, number> = {
    [PlanType.FREE]: 20 * 1024 * 1024, // 20MB
    [PlanType.PREMIUM]: 2 * 1024 * 1024 * 1024, // 2GB
    [PlanType.ENTERPRISE]: 10 * 1024 * 1024 * 1024, // 10GB
  };
  return quotas[planType];
}

/**
 * Procesa un pago aprobado: actualiza el perfil del usuario y crea suscripción
 */
export async function processApprovedPayment(
  userId: string,
  transactionId: string,
  gateway: PaymentGateway,
  planType: PlanType,
  amount: number,
  payload: Record<string, any>
): Promise<boolean> {
  try {
    // 1. Registrar webhook en BD
    const { error: webhookError } = await supabaseAdmin.from('payment_webhooks').insert({
      user_id: userId,
      transaction_id: transactionId,
      payment_gateway: gateway,
      amount: amount / 100, // Convertir de centavos a pesos
      currency: 'COP',
      status: PaymentStatus.APPROVED,
      plan_type: planType,
      webhook_payload: payload,
      processed_at: new Date().toISOString(),
    });

    if (webhookError) {
      console.error('Error registering webhook:', webhookError);
      return false;
    }

    // 2. Actualizar perfil del usuario con nuevo plan
    const storageQuota = getStorageQuotaByPlan(planType);
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        plan_type: planType,
        storage_quota_bytes: storageQuota,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return false;
    }

    // 3. Crear o actualizar suscripción
    const currentDate = new Date();
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const { error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan_type: planType,
          storage_quota_bytes: storageQuota,
          billing_cycle: 'monthly',
          current_period_start: currentDate.toISOString(),
          current_period_end: nextBillingDate.toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (subscriptionError) {
      console.error('Error updating subscription:', subscriptionError);
      return false;
    }

    // 4. Registrar auditoría
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action: 'PAYMENT_APPROVED',
      resource_type: 'subscription',
      resource_id: userId,
      details: {
        transaction_id: transactionId,
        gateway,
        plan_type: planType,
        amount,
      },
    });

    return true;
  } catch (error) {
    console.error('Error processing approved payment:', error);
    return false;
  }
}

/**
 * Procesa un pago fallido
 */
export async function processFailedPayment(
  userId: string | null,
  transactionId: string,
  gateway: PaymentGateway,
  amount: number,
  payload: Record<string, any>
): Promise<boolean> {
  try {
    // Registrar webhook fallido en BD
    const { error } = await supabaseAdmin.from('payment_webhooks').insert({
      user_id: userId,
      transaction_id: transactionId,
      payment_gateway: gateway,
      amount: amount / 100,
      currency: 'COP',
      status: PaymentStatus.FAILED,
      webhook_payload: payload,
      processed_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error registering failed payment:', error);
      return false;
    }

    if (userId) {
      // Registrar auditoría
      await supabaseAdmin.from('audit_logs').insert({
        user_id: userId,
        action: 'PAYMENT_FAILED',
        resource_type: 'subscription',
        resource_id: userId,
        details: {
          transaction_id: transactionId,
          gateway,
          amount,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Error processing failed payment:', error);
    return false;
  }
}

/**
 * Obtiene el usuario por correo electrónico
 */
export async function getUserByEmail(email: string): Promise<{ id: string } | null> {
  const { data } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();

  return data;
}
