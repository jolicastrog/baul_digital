import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getRequestMeta } from '@/lib/utils/requestMeta';

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
    const reason: string | null = body?.reason ?? null;

    const { ip_address, user_agent } = getRequestMeta(request);

    const { data, error } = await supabaseAdmin.rpc('request_account_deletion', {
      p_user_id: user.id,
      p_reason:  reason,
      p_ip:      ip_address,
      p_ua:      user_agent,
    });

    if (error) {
      console.error('[request-deletion] RPC error:', error);
      return NextResponse.json({ error: 'Error al procesar la solicitud.' }, { status: 500 });
    }

    const result = data as { success: boolean; error?: string; scheduled_for?: string; days_remaining?: number };

    if (!result.success) {
      const status = result.error === 'deletion_already_requested' ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    // Registrar email de aviso en email_logs
    void supabaseAdmin.from('email_logs').insert({
      user_id:   user.id,
      recipient: user.email,
      template:  'deletion_warning',
      subject:   'Solicitud de cierre de cuenta recibida — Baúl Digital',
      metadata:  { scheduled_for: result.scheduled_for, days_remaining: result.days_remaining },
    });

    return NextResponse.json({
      success:        true,
      scheduled_for:  result.scheduled_for,
      days_remaining: result.days_remaining,
    });
  } catch (err) {
    console.error('[request-deletion] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
