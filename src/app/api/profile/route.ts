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

/** Autentica la petición y retorna el user_id, o null si no hay sesión válida. */
async function getAuthUserId(): Promise<string | null> {
  const supabase = getAnonSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

// GET — obtener perfil completo (usa función BD get_user_profile)
export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: result, error: rpcError } = await supabaseAdmin
      .rpc('get_user_profile', { p_user_id: userId });

    if (rpcError) {
      console.error('get_user_profile RPC error:', rpcError);
      return NextResponse.json({ error: 'Error al cargar el perfil.' }, { status: 500 });
    }

    const res = result as { found: boolean; profile?: unknown; error?: string };

    if (!res.found) {
      return NextResponse.json({ error: res.error ?? 'Perfil no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ profile: res.profile });
  } catch (err) {
    console.error('GET /api/profile error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

// PATCH — actualizar datos del perfil (usa función BD update_user_profile)
export async function PATCH(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { nombres, apellidos, cedula_unica, cedula_tipo, phone } = body;

    const { data: result, error: rpcError } = await supabaseAdmin
      .rpc('update_user_profile', {
        p_user_id:      userId,
        p_nombres:      nombres      ?? null,
        p_apellidos:    apellidos    ?? null,
        p_cedula_unica: cedula_unica ?? null,
        p_cedula_tipo:  cedula_tipo  ?? null,
        p_phone:        phone        ?? null,
      });

    if (rpcError) {
      console.error('update_user_profile RPC error:', rpcError);
      return NextResponse.json({ error: 'Error al guardar el perfil.' }, { status: 500 });
    }

    const res = result as { success?: boolean; profile?: unknown; error?: string; message?: string };

    if (res.error) {
      const status = res.error === 'cedula_taken' ? 409 : 400;
      return NextResponse.json({ error: res.message }, { status });
    }

    // Registrar en audit log (sin bloquear la respuesta)
    const { ip_address, user_agent } = getRequestMeta(request);
    void supabaseAdmin.from('audit_logs').insert({
      user_id:       userId,
      action:        'PROFILE_UPDATED',
      resource_type: 'profile',
      resource_id:   userId,
      ip_address,
      user_agent,
      details:       { fields_updated: Object.keys(body) },
      retain_until:  new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return NextResponse.json({ success: true, profile: res.profile });
  } catch (err) {
    console.error('PATCH /api/profile error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

// POST — cambiar contraseña
export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres.' },
        { status: 400 }
      );
    }

    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password }
    );

    if (pwError) {
      return NextResponse.json({ error: 'No se pudo cambiar la contraseña. Intenta de nuevo.' }, { status: 500 });
    }

    const { ip_address, user_agent } = getRequestMeta(request);
    void supabaseAdmin.from('audit_logs').insert({
      user_id:       userId,
      action:        'PASSWORD_CHANGED',
      resource_type: 'profile',
      resource_id:   userId,
      ip_address,
      user_agent,
      retain_until:  new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/profile error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
