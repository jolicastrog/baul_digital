import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

function getAnonSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cs) {
          cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
}

export async function GET(request: Request) {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') ?? null;
    const to   = searchParams.get('to')   ?? null;

    const { data, error } = await supabase.rpc('get_payment_history', {
      p_user_id: user.id,
      p_from:    from,
      p_to:      to,
    });

    if (error) {
      console.error('[payment-history] RPC error:', error);
      return NextResponse.json({ error: 'Error al obtener el historial.' }, { status: 500 });
    }

    return NextResponse.json({ payments: data ?? [] });
  } catch (err) {
    console.error('[payment-history] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
