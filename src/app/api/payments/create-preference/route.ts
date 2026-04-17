import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { MercadoPagoConfig, Preference } from 'mercadopago';
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

    // Leer precio directamente desde la tabla plans (fuente de verdad en BD)
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('name, price_monthly_cop, price_semiannual_cop, price_annual_cop')
      .eq('code', planType)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 400 });
    }

    const priceMap: Record<string, number> = {
      monthly:    plan.price_monthly_cop,
      semiannual: plan.price_semiannual_cop,
      annual:     plan.price_annual_cop,
    };

    const unitPrice = priceMap[billingCycle];
    if (!unitPrice) {
      return NextResponse.json({ error: 'Ciclo de facturación inválido' }, { status: 400 });
    }

    const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const preference = new Preference(mp);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://baul-digital.vercel.app';

    const result = await preference.create({
      body: {
        items: [{
          id:          `${planType}-${billingCycle}`,
          title:       `${plan.name} — ${CYCLE_LABELS[billingCycle]}`,
          unit_price:  unitPrice,
          quantity:    1,
          currency_id: 'COP',
        }],
        payer:              { email: user.email },
        external_reference: `${planType}|${billingCycle}|${user.id}`,
        notification_url:   `${appUrl}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${appUrl}/dashboard/pricing?payment=success`,
          failure: `${appUrl}/dashboard/pricing?payment=failed`,
          pending: `${appUrl}/dashboard/pricing?payment=pending`,
        },
        auto_return: 'approved',
      },
    });

    return NextResponse.json({
      preferenceId: result.id,
      initPoint:    result.init_point,
    });
  } catch (error) {
    console.error('[create-preference] Error:', error);
    return NextResponse.json({ error: 'Error al crear preferencia de pago' }, { status: 500 });
  }
}
