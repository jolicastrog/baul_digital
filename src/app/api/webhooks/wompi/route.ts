import { NextRequest, NextResponse } from 'next/server';
import {
  validateWompiSignature,
  processApprovedPayment,
  processFailedPayment,
  getUserByEmail,
  WompiPaymentNotification,
} from '@/services/paymentService';
import { PlanType, PaymentGateway } from '@/types';

export const POST = async (request: NextRequest) => {
  try {
    // 1. Obtener payload y signature
    const payload = await request.text();
    const signature = request.headers.get('X-Wompi-Signature');

    if (!signature) {
      console.warn('Missing Wompi signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // 2. Validar firma (seguridad)
    if (!validateWompiSignature(payload, signature)) {
      console.warn('Invalid Wompi signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 3. Parsear notificación
    const notification: WompiPaymentNotification = JSON.parse(payload);

    // Solo procesar eventos de transacción completada
    if (notification.event !== 'transaction.updated') {
      return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
    }

    const transaction = notification.data.transaction;
    const transactionId = transaction.id;
    const customerEmail = transaction.customer_email;

    // 4. Obtener usuario por email
    const user = await getUserByEmail(customerEmail);
    if (!user) {
      console.warn(`User not found for email: ${customerEmail}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 5. Mapear estado de Wompi a nuestro estado
    const isApproved = transaction.status === 'APPROVED';

    let success = false;
    if (isApproved) {
      // Mapear referencia a tipo de plan (debe incluir info del plan en la referencia)
      // Ej: "premium-monthly-{userId}-{timestamp}"
      const planType = transaction.reference.includes('enterprise')
        ? PlanType.ENTERPRISE
        : PlanType.PREMIUM;

      success = await processApprovedPayment(
        user.id,
        transactionId,
        PaymentGateway.WOMPI,
        planType,
        transaction.amount_in_cents,
        notification.data
      );
    } else {
      success = await processFailedPayment(
        user.id,
        transactionId,
        PaymentGateway.WOMPI,
        transaction.amount_in_cents,
        notification.data
      );
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to process payment' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Webhook processed successfully', transactionId },
      { status: 200 }
    );
  } catch (error) {
    console.error('Wompi webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
};
