import { NextRequest, NextResponse } from 'next/server';
import {
  validateEPaycoSignature,
  processApprovedPayment,
  processFailedPayment,
  getUserByEmail,
} from '@/services/paymentService';
import { PlanType } from '@/types';

export const POST = async (request: NextRequest) => {
  try {
    // 1. Obtener datos del formulario (ePayco envía datos urlencoded)
    const formData = await request.formData();
    const params: Record<string, string> = {};

    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    // 2. Validar firma (seguridad)
    if (!validateEPaycoSignature(params)) {
      console.warn('Invalid ePayco signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 3. Obtener datos de notificación
    const transactionId = params.x_transaction_id;
    const customerEmail = params.x_customer_email;
    const responseCode = params.x_response;
    const amount = Math.round(parseFloat(params.x_amount) * 100); // Convertir a centavos

    // 4. Obtener usuario por email
    const user = await getUserByEmail(customerEmail);
    if (!user) {
      console.warn(`User not found for email: ${customerEmail}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 5. Procesar según respuesta
    // Códigos de respuesta de ePayco: 1 = aprobado, otros = fallido
    const isApproved = responseCode === '1';

    let success = false;
    if (isApproved) {
      // Mapear referencia a tipo de plan
      // Ej: "premium-monthly-{userId}-{timestamp}"
      const planType = params.x_ref_payco.includes('enterprise')
        ? PlanType.ENTERPRISE
        : PlanType.PREMIUM;

      success = await processApprovedPayment(
        user.id,
        transactionId,
        'epayco',
        planType,
        amount,
        Object.fromEntries(params)
      );
    } else {
      success = await processFailedPayment(
        user.id,
        transactionId,
        'epayco',
        amount,
        Object.fromEntries(params)
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
    console.error('ePayco webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
};
