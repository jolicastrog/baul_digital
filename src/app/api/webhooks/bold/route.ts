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
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody  = await request.text();
    const signature = request.headers.get('x-bold-signature') ?? '';

    if (!validateBoldSignature(rawBody, signature)) {
      console.warn('[bold-webhook] Firma inválida');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    // Bold envía el estado en body.status o body.data.status según el evento
    const status        = body?.status ?? body?.data?.status ?? '';
    const transactionId = String(body?.id ?? body?.data?.id ?? body?.transaction_id ?? '');
    const amount        = Number(body?.amount ?? body?.data?.amount ?? body?.total_amount ?? 0);
    const payerEmail    = body?.payer_email ?? body?.data?.payer_email ?? '';

    // Extraer plan y ciclo desde callback_url ref param: "premium|monthly|<userId>"
    const callbackUrl  = body?.callback_url ?? body?.data?.callback_url ?? '';
    const refMatch     = callbackUrl.match(/ref=([^&]+)/);
    const refParts     = refMatch ? decodeURIComponent(refMatch[1]).split('|') : [];
    const [planStr, cycleStr, userId] = refParts;

    const planType: PlanType = planStr === 'enterprise' ? PlanType.ENTERPRISE : PlanType.PREMIUM;
    const billingCycle = (['monthly', 'semiannual', 'annual'].includes(cycleStr)
      ? cycleStr
      : 'monthly') as 'monthly' | 'semiannual' | 'annual';

    if (status === 'PAID') {
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
    } else if (['EXPIRED', 'REJECTED', 'CANCELLED'].includes(status)) {
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
