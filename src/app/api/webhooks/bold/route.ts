import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  processApprovedPayment,
  processFailedPayment,
  getUserByEmail,
} from '@/services/paymentService';
import { PlanType, PaymentGateway } from '@/types';

export const dynamic = 'force-dynamic';

function validateBoldSignature(rawBody: string, signature: string): boolean {
  try {
    const secret = process.env.BOLD_SECRET_KEY ?? '';
    const expectedHex = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const expectedB64 = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');
    console.log('[bold-webhook] signature recibida:', signature.slice(0, 20) + '...');
    console.log('[bold-webhook] expected hex:', expectedHex.slice(0, 20) + '...');
    console.log('[bold-webhook] expected b64:', expectedB64.slice(0, 20) + '...');
    // Bold envía el HMAC en hex
    const sigBuf      = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedHex);
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

// Bold usa CloudEvents: type = "SALE_APPROVED" | "SALE_REJECTED" | "SALE_VOIDED"
const BOLD_APPROVED_TYPES = new Set(['SALE_APPROVED']);
const BOLD_FAILED_TYPES   = new Set(['SALE_REJECTED', 'SALE_VOIDED', 'SALE_CHARGEBACK']);

export async function POST(request: NextRequest) {
  try {
    const rawBody   = await request.text();
    const signature = request.headers.get('x-bold-signature') ?? '';

    console.log('[bold-webhook] rawBody completo:', rawBody);

    // BOLD_SKIP_SIGNATURE=1 solo para diagnóstico — retirar en producción real
    const skipSig = process.env.BOLD_SKIP_SIGNATURE === '1';
    if (!skipSig && !validateBoldSignature(rawBody, signature)) {
      console.warn('[bold-webhook] Firma inválida — signature:', signature.slice(0, 30));
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log('[bold-webhook] event type:', body?.type, '| data keys:', Object.keys(body?.data ?? {}));

    // Bold CloudEvents: el tipo de evento determina el estado
    const eventType     = body?.type ?? '';
    const transactionId = String(body?.data?.payment_id ?? body?.data?.id ?? body?.id ?? '');
    const amountObj     = body?.data?.amount;
    const amount        = amountObj
      ? Number(amountObj.total_amount ?? amountObj.total ?? amountObj.amount ?? 0)
      : 0;
    const payerEmail    = body?.data?.payer_email ?? body?.data?.customer?.email ?? '';

    // Bold devuelve el reference en data.metadata.reference
    const reference = String(body?.data?.reference ?? body?.data?.metadata?.reference ?? '');
    console.log('[bold-webhook] reference:', reference);

    // Formato nuevo: BD-{pre|ent}-{mo|sa|an}-{uuid-completo}-{6digits}
    // Formato viejo: BD-{premium|enterprise}-{monthly|...}-{8chars}-{ts} (compatibilidad)
    let resolvedUserId = '';
    let planStr  = '';
    let cycleStr = '';

    const newFmt = reference.match(
      /^BD-(pre|ent)-(mo|sa|an)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-/i
    );
    if (newFmt) {
      planStr         = newFmt[1] === 'ent' ? 'enterprise' : 'premium';
      cycleStr        = ({ mo: 'monthly', sa: 'semiannual', an: 'annual' } as Record<string, string>)[newFmt[2]] ?? 'monthly';
      resolvedUserId  = newFmt[3];
    } else {
      // Compatibilidad con references viejos (sin UUID completo)
      const oldFmt = reference.match(/^BD-(premium|enterprise)-(monthly|semiannual|annual)-/);
      if (oldFmt) { planStr = oldFmt[1]; cycleStr = oldFmt[2]; }
    }

    console.log('[bold-webhook] parsed:', { planStr, cycleStr, resolvedUserId: resolvedUserId.slice(0, 8) || '(vacío)' }, '| payer:', payerEmail);

    const planType: PlanType = planStr === 'enterprise' ? PlanType.ENTERPRISE : PlanType.PREMIUM;
    const billingCycle = (['monthly', 'semiannual', 'annual'].includes(cycleStr)
      ? cycleStr
      : 'monthly') as 'monthly' | 'semiannual' | 'annual';

    if (BOLD_APPROVED_TYPES.has(eventType)) {
      // Fallback por email si el reference no tenía UUID completo
      if (!resolvedUserId && payerEmail) {
        const user = await getUserByEmail(payerEmail);
        resolvedUserId = user?.id ?? '';
      }

      if (!resolvedUserId) {
        console.warn('[bold-webhook] Usuario no identificado');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      console.log('[bold-webhook] procesando pago aprobado para:', resolvedUserId, '| plan:', planType, billingCycle, '| amount:', amount);
      const ok = await processApprovedPayment(
        resolvedUserId,
        transactionId,
        PaymentGateway.BOLD,
        planType,
        // Bold test env envía amount=0; usamos 1 como mínimo para que el RPC no lo rechace
        amount > 0 ? amount : 1,
        billingCycle,
        body
      );
      console.log('[bold-webhook] processApprovedPayment result:', ok);
    } else if (BOLD_FAILED_TYPES.has(eventType)) {
      const failedUser = resolvedUserId ? null : (payerEmail ? await getUserByEmail(payerEmail) : null);
      await processFailedPayment(
        resolvedUserId || failedUser?.id || null,
        transactionId,
        PaymentGateway.BOLD,
        amount,
        body
      );
    }

    // Bold requiere respuesta 200 en menos de 2 segundos
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[bold-webhook] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
