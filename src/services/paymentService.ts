import { createClient } from '@supabase/supabase-js';
import { PaymentGateway, PaymentStatus, PlanType } from '@/types';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================================
// VALIDACIÓN WEBHOOK MERCADOPAGO
// El header x-signature tiene formato: ts=<timestamp>,v1=<hmac>
// ============================================================================

export function validateMercadoPagoSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string
): boolean {
  try {
    const secret = process.env.MP_WEBHOOK_SECRET || '';
    const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')));
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getStorageQuotaByPlan(planType: PlanType): number {
  const quotas: Record<PlanType, number> = {
    [PlanType.FREE]:       20 * 1024 * 1024,
    [PlanType.PREMIUM]:   500 * 1024 * 1024,
    [PlanType.ENTERPRISE]: 5  * 1024 * 1024 * 1024,
  };
  return quotas[planType];
}

export async function getUserByEmail(email: string): Promise<{ id: string } | null> {
  const { data } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
  return data;
}

// ============================================================================
// PROCESAMIENTO DE PAGOS
// ============================================================================

export async function processApprovedPayment(
  userId: string,
  transactionId: string,
  gateway: PaymentGateway,
  planType: PlanType,
  amount: number,
  billingCycle: 'monthly' | 'semiannual' | 'annual',
  payload: Record<string, any>
): Promise<boolean> {
  try {
    await supabaseAdmin.from('payment_webhooks').insert({
      user_id:         userId,
      transaction_id:  transactionId,
      payment_gateway: gateway,
      amount,
      currency:        'COP',
      status:          PaymentStatus.APPROVED,
      plan_type:       planType,
      webhook_payload: payload,
      processed_at:    new Date().toISOString(),
    });

    const storageQuota = getStorageQuotaByPlan(planType);
    await supabaseAdmin.from('profiles').update({
      plan_type:           planType,
      storage_quota_bytes: storageQuota,
      updated_at:          new Date().toISOString(),
    }).eq('id', userId);

    const periodMonths = billingCycle === 'annual' ? 12 : billingCycle === 'semiannual' ? 6 : 1;
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);

    await supabaseAdmin.from('subscriptions').upsert({
      user_id:               userId,
      plan_type:             planType,
      storage_quota_bytes:   storageQuota,
      billing_cycle:         billingCycle === 'monthly' ? 'monthly' : 'yearly',
      current_period_start:  new Date().toISOString(),
      current_period_end:    periodEnd.toISOString(),
      is_active:             true,
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'user_id' });

    await supabaseAdmin.from('audit_logs').insert({
      user_id:       userId,
      action:        'PAYMENT_APPROVED',
      resource_type: 'subscription',
      resource_id:   userId,
      details:       { transaction_id: transactionId, gateway, plan_type: planType, amount },
    });

    return true;
  } catch (error) {
    console.error('[paymentService] processApprovedPayment error:', error);
    return false;
  }
}

export async function processFailedPayment(
  userId: string | null,
  transactionId: string,
  gateway: PaymentGateway,
  amount: number,
  payload: Record<string, any>
): Promise<boolean> {
  try {
    await supabaseAdmin.from('payment_webhooks').insert({
      user_id:         userId,
      transaction_id:  transactionId,
      payment_gateway: gateway,
      amount,
      currency:        'COP',
      status:          PaymentStatus.FAILED,
      webhook_payload: payload,
      processed_at:    new Date().toISOString(),
    });

    if (userId) {
      await supabaseAdmin.from('audit_logs').insert({
        user_id:       userId,
        action:        'PAYMENT_FAILED',
        resource_type: 'subscription',
        resource_id:   userId,
        details:       { transaction_id: transactionId, gateway, amount },
      });
    }

    return true;
  } catch (error) {
    console.error('[paymentService] processFailedPayment error:', error);
    return false;
  }
}
