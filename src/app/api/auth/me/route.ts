import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
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

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Usa la función BD para obtener el perfil (misma que usa /api/profile)
    const { data: result, error: rpcError } = await supabaseAdmin
      .rpc('get_user_profile', { p_user_id: user.id });

    if (rpcError || !result) {
      console.error('get_user_profile error in /api/auth/me:', rpcError);
      return NextResponse.json({ error: 'Error al cargar el perfil.' }, { status: 500 });
    }

    const res = result as { found: boolean; profile?: Record<string, unknown> };

    return NextResponse.json({
      user:    { id: user.id, email: user.email },
      profile: res.found ? res.profile : null,
    });
  } catch {
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
