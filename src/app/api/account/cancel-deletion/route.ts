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

    const { ip_address, user_agent } = getRequestMeta(request);

    const { data, error } = await supabaseAdmin.rpc('cancel_account_deletion', {
      p_user_id: user.id,
      p_ip:      ip_address,
      p_ua:      user_agent,
    });

    if (error) {
      console.error('[cancel-deletion] RPC error:', error);
      return NextResponse.json({ error: 'Error al cancelar la solicitud.' }, { status: 500 });
    }

    const result = data as { success: boolean; error?: string };

    if (!result.success) {
      const status = result.error === 'no_pending_deletion' ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    // Registrar email de confirmación de cancelación
    void supabaseAdmin.from('email_logs').insert({
      user_id:   user.id,
      recipient: user.email,
      template:  'deletion_cancelled',
      subject:   'Tu solicitud de cierre de cuenta ha sido cancelada — Baúl Digital',
      metadata:  { cancelled_by: 'user' },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[cancel-deletion] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
