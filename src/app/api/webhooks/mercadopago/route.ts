import { NextRequest, NextResponse } from 'next/server';
import {
  validateMercadoPagoSignature,
  processApprovedPayment,
  processFailedPayment,
  getUserByEmail,
} from '@/services/paymentService';
import { PlanType, PaymentGateway } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const xSignature  = request.headers.get('x-signature')  ?? '';
    const xRequestId  = request.headers.get('x-request-id') ?? '';
    const { searchParams } = new URL(request.url);
    const dataId = searchParams.get('data.id') ?? searchParams.get('id') ?? '';

    if (!validateMercadoPagoSignature(xSignature, xRequestId, dataId)) {
      console.warn('[mp-webhook] Firma inválida');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = await request.json();
    const topic = body.type ?? body.topic;

    if (topic !== 'payment') {
      return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
    }

    // Consultar detalle del pago a la API de MP
    const paymentId = body.data?.id ?? dataId;
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });

    if (!mpRes.ok) {
      console.error('[mp-webhook] No se pudo obtener el pago:', paymentId);
      return NextResponse.json({ error: 'Payment fetch failed' }, { status: 502 });
    }

    const payment = await mpRes.json();
    const email   = payment.payer?.email ?? '';
    const amount  = payment.transaction_amount ?? 0;

    // Extraer plan y ciclo desde external_reference: "premium|monthly|<userId>"
    const [planStr, cycleStr] = (payment.external_reference ?? '').split('|');
    const planType = planStr === 'enterprise' ? PlanType.ENTERPRISE : PlanType.PREMIUM;
    const billingCycle = (['monthly', 'semiannual', 'annual'].includes(cycleStr)
      ? cycleStr
      : 'monthly') as 'monthly' | 'semiannual' | 'annual';

    const user = await getUserByEmail(email);

    if (payment.status === 'approved') {
      if (!user) {
        console.warn('[mp-webhook] Usuario no encontrado:', email);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      await processApprovedPayment(user.id, String(paymentId), PaymentGateway.MERCADOPAGO, planType, amount, billingCycle, payment);
    } else if (['rejected', 'cancelled', 'refunded'].includes(payment.status)) {
      await processFailedPayment(user?.id ?? null, String(paymentId), PaymentGateway.MERCADOPAGO, amount, payment);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[mp-webhook] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
