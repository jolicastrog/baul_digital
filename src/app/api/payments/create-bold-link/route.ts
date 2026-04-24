import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { PlanType } from '@/types';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CYCLE_LABELS: Record<string, string> = {
  monthly:    'Mensual',
  semiannual: 'Semestral',
  annual:     'Anual',
};

// Bold usa la misma URL para test y producción — solo cambian las llaves (BOLD_API_KEY / BOLD_SECRET_KEY)
const BOLD_BASE_URL = process.env.BOLD_API_URL ?? 'https://integrations.api.bold.co';

export async function POST(request: NextRequest) {
  try {
    // Verificar sesión
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

    if (planType === PlanType.FREE) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
    }

    // Leer precio desde la BD (fuente de verdad)
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('name, price_monthly_cop, price_semiannual_cop, price_annual_cop')
      .eq('code', planType)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      console.error('[create-bold-link] Plan no encontrado:', { planType, planError });
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 400 });
    }

    console.log('[create-bold-link] Plan desde BD:', {
      name: plan.name,
      price_monthly_cop:    plan.price_monthly_cop,
      price_semiannual_cop: plan.price_semiannual_cop,
      price_annual_cop:     plan.price_annual_cop,
    });

    // Precio por mes según ciclo × número de meses del período
    const CYCLE_MONTHS: Record<string, number> = {
      monthly:    1,
      semiannual: 6,
      annual:     12,
    };

    const monthlyRate: Record<string, number> = {
      monthly:    plan.price_monthly_cop,
      semiannual: plan.price_semiannual_cop,
      annual:     plan.price_annual_cop,
    };

    const months = CYCLE_MONTHS[billingCycle];
    const rate   = monthlyRate[billingCycle];

    if (!months || rate == null) {
      return NextResponse.json({ error: 'Ciclo de facturación inválido' }, { status: 400 });
    }

    const totalAmount = rate * months;

    console.log('[create-bold-link] Cálculo:', { billingCycle, rate, months, totalAmount });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

    // Expiración: 30 minutos desde ahora en nanosegundos
    const expirationDate = (Date.now() + 30 * 60 * 1000) * 1_000_000;

    // reference único (máx 60 chars): codifica plan/ciclo para que el webhook lo extraiga
    const referenceId = `BD-${planType}-${billingCycle}-${user.id.slice(0, 8)}-${Date.now()}`;

    console.log('[create-bold-link] referenceId:', referenceId);

    const boldRes = await fetch(`${BOLD_BASE_URL}/online/link/v1`, {
      method:  'POST',
      headers: {
        'Authorization': `x-api-key ${process.env.BOLD_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount_type:  'CLOSE',
        description:  `Baúl Digital — ${plan.name} ${CYCLE_LABELS[billingCycle]}`,
        amount: {
          currency:     'COP',
          total_amount: totalAmount,
          tip_amount:   0,
          taxes:        [],
        },
        reference:       referenceId,
        expiration_date: expirationDate,
        callback_url:    `${appUrl}/dashboard/pricing?payment=success`,
        payment_methods: ['CREDIT_CARD', 'PSE', 'NEQUI', 'BOTON_BANCOLOMBIA'],
        payer_email:     user.email,
      }),
    });

    if (!boldRes.ok) {
      const errBody = await boldRes.text();
      console.error('[create-bold-link] Bold API error:', boldRes.status, errBody);
      return NextResponse.json({ error: 'Error al crear el link de pago' }, { status: 502 });
    }

    const boldData = await boldRes.json();
    console.log('[create-bold-link] Bold response:', JSON.stringify(boldData));
    const paymentUrl = boldData?.payload?.url ?? boldData?.url;

    if (!paymentUrl) {
      console.error('[create-bold-link] No payment URL in response:', boldData);
      return NextResponse.json({ error: 'Respuesta inválida de Bold' }, { status: 502 });
    }

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    console.error('[create-bold-link] Error:', error);
    return NextResponse.json({ error: 'Error interno al crear el link de pago' }, { status: 500 });
  }
}
