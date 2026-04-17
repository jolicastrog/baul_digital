import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { PlanType } from '@/types';

export const dynamic = 'force-dynamic';

const PRICES: Record<PlanType, Record<string, number>> = {
  [PlanType.FREE]:       { monthly: 0,     semiannual: 0,     annual: 0 },
  [PlanType.PREMIUM]:    { monthly: 9900,  semiannual: 8415,  annual: 7425 },
  [PlanType.ENTERPRISE]: { monthly: 49900, semiannual: 42415, annual: 37425 },
};

const PLAN_LABELS: Record<PlanType, string> = {
  [PlanType.FREE]:       'Plan Gratuito',
  [PlanType.PREMIUM]:    'Plan Premium',
  [PlanType.ENTERPRISE]: 'Plan Empresarial',
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

    const unitPrice = PRICES[planType]?.[billingCycle];
    if (!unitPrice) {
      return NextResponse.json({ error: 'Precio no encontrado' }, { status: 400 });
    }

    const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const preference = new Preference(mp);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://baul-digital.vercel.app';

    const result = await preference.create({
      body: {
        items: [{
          id:          `${planType}-${billingCycle}`,
          title:       `${PLAN_LABELS[planType]} — ${billingCycle === 'monthly' ? 'Mensual' : billingCycle === 'semiannual' ? 'Semestral' : 'Anual'}`,
          unit_price:  unitPrice,
          quantity:    1,
          currency_id: 'COP',
        }],
        payer: { email: user.email },
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
