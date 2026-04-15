import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// Cliente admin para consultas de BD sin restricción RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const cookieStore = cookies();

    // Solo usamos el cliente anon para verificar la sesión
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

    // Usamos admin para leer el perfil sin que RLS interfiera
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email, plan_type, storage_used_bytes, storage_quota_bytes')
      .eq('id', user.id)
      .single();

    return NextResponse.json({ user: { id: user.id, email: user.email }, profile });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
