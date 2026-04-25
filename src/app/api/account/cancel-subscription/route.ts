import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getRequestMeta } from '@/lib/utils/requestMeta';
import { sendEmail } from '@/lib/email/sendEmail';
import { subscriptionCancelledHtml } from '@/lib/email/templates';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getAnonSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body?.reason ?? 'Cancelado por el usuario';

    const { ip_address, user_agent } = getRequestMeta(request);

    const { data, error } = await supabaseAdmin.rpc('cancel_subscription', {
      p_user_id: user.id,
      p_reason:  reason,
      p_ip:      ip_address,
      p_ua:      user_agent,
    });

    if (error) {
      console.error('[cancel-subscription] RPC error:', error);
      return NextResponse.json({ error: 'Error al cancelar la suscripción.' }, { status: 500 });
    }

    const result = data as { success: boolean; error?: string; message?: string; period_end?: string; plan_type?: string };

    if (!result.success) {
      const status = result.error === 'no_active_subscription' ? 404 : 400;
      return NextResponse.json({ error: result.message ?? result.error }, { status });
    }

    // Email de confirmación (fire-and-forget, igual que request-deletion)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const fullName  = profile?.full_name ?? user.email ?? 'Usuario';
    const planLabel = result.plan_type === 'enterprise' ? 'Enterprise' : 'Premium';
    const periodEnd = new Date(result.period_end!).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    void sendEmail({
      to:       user.email!,
      subject:  `Tu suscripción ${planLabel} ha sido cancelada — Baúl Digital`,
      html:     subscriptionCancelledHtml({ fullName, planLabel, periodEnd }),
      template: 'subscription_cancelled',
      userId:   user.id,
      metadata: { plan_type: result.plan_type, period_end: result.period_end },
    });

    return NextResponse.json({
      success:    true,
      period_end: result.period_end,
      plan_type:  result.plan_type,
      message:    result.message,
    });
  } catch (err) {
    console.error('[cancel-subscription] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
