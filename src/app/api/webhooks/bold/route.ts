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
      ? Number(amountObj.total_amount ?? amountObj.amount ?? 0)
      : Number(body?.data?.total_amount ?? body?.total_amount ?? 0);
    const payerEmail    = body?.data?.customer?.email ?? body?.data?.payer_email ?? body?.payer_email ?? '';

    // Extraer plan y ciclo desde callback_url ref param: "premium|monthly|<userId>"
    const callbackUrl = body?.data?.callback_url ?? body?.data?.metadata?.callback_url ?? body?.callback_url ?? '';
    const refMatch    = callbackUrl.match(/ref=([^&]+)/);
    const refParts    = refMatch ? decodeURIComponent(refMatch[1]).split('|') : [];
    const [planStr, cycleStr, userId] = refParts;

    console.log('[bold-webhook] callbackUrl:', callbackUrl, '| ref parts:', refParts);

    const planType: PlanType = planStr === 'enterprise' ? PlanType.ENTERPRISE : PlanType.PREMIUM;
    const billingCycle = (['monthly', 'semiannual', 'annual'].includes(cycleStr)
      ? cycleStr
      : 'monthly') as 'monthly' | 'semiannual' | 'annual';

    if (BOLD_APPROVED_TYPES.has(eventType)) {
      // Buscar usuario por userId (desde ref) o por email como fallback
      let resolvedUserId = userId;
      if (!resolvedUserId && payerEmail) {
        const user = await getUserByEmail(payerEmail);
        resolvedUserId = user?.id ?? '';
      }

      if (!resolvedUserId) {
        console.warn('[bold-webhook] Usuario no identificado');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      await processApprovedPayment(
        resolvedUserId,
        transactionId,
        PaymentGateway.BOLD,
        planType,
        amount,
        billingCycle,
        body
      );
    } else if (BOLD_FAILED_TYPES.has(eventType)) {
      const user = userId ? null : (payerEmail ? await getUserByEmail(payerEmail) : null);
      await processFailedPayment(
        userId || user?.id || null,
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
