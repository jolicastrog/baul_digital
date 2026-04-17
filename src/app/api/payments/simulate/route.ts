import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { PlanType, PaymentGateway } from '@/types';

export const dynamic = 'force-dynamic';

// Solo disponible fuera de producción
const IS_PRODUCTION = process.env.NEXT_PUBLIC_APP_ENV === 'production';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  if (IS_PRODUCTION) {
    return NextResponse.json({ error: 'No disponible en producción' }, { status: 403 });
  }

  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { planType, billingCycle } = await request.json() as {
      planType: PlanType;
      billingCycle: 'monthly' | 'semiannual' | 'annual';
    };

    if (!planType || planType === PlanType.FREE) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
    }

    // Obtener precio desde BD
    const { data: plan } = await supabaseAdmin
      .from('plans')
      .select('price_monthly_cop, price_semiannual_cop, price_annual_cop')
      .eq('code', planType)
      .single();

    const priceMap: Record<string, number> = {
      monthly:    plan?.price_monthly_cop    ?? 0,
      semiannual: plan?.price_semiannual_cop ?? 0,
      annual:     plan?.price_annual_cop     ?? 0,
    };

    const fakeTransactionId = `SIM-${Date.now()}-${user.id.slice(0, 8)}`;

    const { error } = await supabaseAdmin.rpc('process_approved_payment', {
      p_user_id:        user.id,
      p_transaction_id: fakeTransactionId,
      p_gateway:        PaymentGateway.MERCADOPAGO,
      p_plan_type:      planType,
      p_amount:         priceMap[billingCycle],
      p_billing_cycle:  billingCycle,
      p_payload:        {
        simulated:        true,
        preference_id:    null,
        payment_type_id:  'simulated',
        payer:            { email: user.email },
      },
    });

    if (error) {
      console.error('[simulate] RPC error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, transactionId: fakeTransactionId });
  } catch (error: any) {
    console.error('[simulate] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
