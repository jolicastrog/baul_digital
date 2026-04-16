import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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

// GET — obtener perfil completo
export async function GET() {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PATCH — actualizar datos del perfil
export async function PATCH(request: Request) {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { nombres, apellidos, cedula_unica, cedula_tipo, phone } = body;

    // Verificar que cedula_unica no la use otro usuario
    if (cedula_unica) {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('cedula_unica', cedula_unica)
        .neq('id', user.id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Esa cédula ya está registrada por otro usuario' },
          { status: 409 }
        );
      }
    }

    const updates: Record<string, string | null> = {};
    if (nombres     !== undefined) updates.nombres     = nombres;
    if (apellidos   !== undefined) updates.apellidos   = apellidos;
    if (cedula_unica !== undefined) updates.cedula_unica = cedula_unica;
    if (cedula_tipo  !== undefined) updates.cedula_tipo  = cedula_tipo;
    if (phone        !== undefined) updates.phone        = phone;

    const { data: profile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Registrar en audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'PROFILE_UPDATED',
      resource_type: 'profile',
      resource_id: user.id,
      details: { fields_updated: Object.keys(updates) },
    });

    return NextResponse.json({ success: true, profile });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — cambiar contraseña
export async function POST(request: Request) {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      );
    }

    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 500 });
    }

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'PASSWORD_CHANGED',
      resource_type: 'profile',
      resource_id: user.id,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
