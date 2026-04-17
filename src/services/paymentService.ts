import { createClient } from '@supabase/supabase-js';
import { PaymentGateway, PlanType } from '@/types';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================================
// VALIDACIÓN WEBHOOK MERCADOPAGO
// Header x-signature formato: ts=<timestamp>,v1=<hmac>
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
// PROCESAMIENTO DE PAGOS — delega toda la lógica a funciones de BD
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
  const { error } = await supabaseAdmin.rpc('process_approved_payment', {
    p_user_id:        userId,
    p_transaction_id: transactionId,
    p_gateway:        gateway,
    p_plan_type:      planType,
    p_amount:         amount,
    p_billing_cycle:  billingCycle,
    p_payload:        payload,
  });

  if (error) {
    console.error('[paymentService] process_approved_payment error:', error);
    return false;
  }
  return true;
}

export async function processFailedPayment(
  userId: string | null,
  transactionId: string,
  gateway: PaymentGateway,
  amount: number,
  payload: Record<string, any>
): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc('process_failed_payment', {
    p_user_id:        userId,
    p_transaction_id: transactionId,
    p_gateway:        gateway,
    p_amount:         amount,
    p_payload:        payload,
  });

  if (error) {
    console.error('[paymentService] process_failed_payment error:', error);
    return false;
  }
  return true;
}

export async function getUserByEmail(email: string): Promise<{ id: string } | null> {
  const { data } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
  return data;
}
