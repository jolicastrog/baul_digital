import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mensajes de error de Supabase Auth traducidos al español
const AUTH_ERROR_ES: Record<string, string> = {
  'User already registered':
    'Este correo electrónico ya está registrado. Intenta iniciar sesión.',
  'Password should be at least 6 characters.':
    'La contraseña debe tener al menos 6 caracteres.',
  'Signup requires a valid password':
    'Se requiere una contraseña válida.',
  'Invalid email':
    'El correo electrónico no es válido.',
  'Email rate limit exceeded':
    'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
  'over_email_send_rate_limit':
    'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
  'For security purposes, you can only request this once every 60 seconds':
    'Por seguridad, solo puedes intentar una vez cada 60 segundos.',
};

export async function POST(request: Request) {
  let authUserId: string | null = null;

  try {
    const body = await request.json();
    const { email, password, nombres, apellidos, cedulaUnica, cedulaTipo, acceptedTerms } = body;

    if (!email || !password || !nombres || !apellidos || !cedulaUnica || !cedulaTipo) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    if (!acceptedTerms) {
      return NextResponse.json(
        { error: 'Debes aceptar los Términos y la Política de Privacidad para registrarte.' },
        { status: 400 }
      );
    }

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

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombres,
          apellidos,
          full_name:    `${nombres.trim()} ${apellidos.trim()}`,
          cedula_unica: cedulaUnica,
          cedula_tipo:  cedulaTipo,
        },
      },
    });

    if (authError) {
      const msg = AUTH_ERROR_ES[authError.message] ?? 'Error al crear la cuenta. Intenta de nuevo.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'No se pudo crear el usuario.' }, { status: 500 });
    }

    authUserId = authData.user.id;

    // ── Crear / validar perfil vía función de BD ──────────────────────────────
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'register_user_profile',
      {
        p_user_id:           authUserId,
        p_email:             email,
        p_nombres:           nombres,
        p_apellidos:         apellidos,
        p_cedula_unica:      cedulaUnica,
        p_cedula_tipo:       cedulaTipo,
        p_accepted_terms_at: new Date().toISOString(),
        p_terms_version:     '1.0',
      }
    );

    if (rpcError) {
      console.error('[register] RPC register_user_profile error:', rpcError);

      // Fallback: inserción directa si la función falla por permisos/configuración
      const { error: directError } = await supabaseAdmin.from('profiles').upsert({
        id:                authUserId,
        email:             email.trim().toLowerCase(),
        nombres:           nombres.trim(),
        apellidos:         apellidos.trim(),
        full_name:         `${nombres.trim()} ${apellidos.trim()}`,
        cedula_unica:      cedulaUnica.trim(),
        cedula_tipo:       cedulaTipo,
        accepted_terms_at: new Date().toISOString(),
        terms_version:     '1.0',
      }, { onConflict: 'id' });

      if (directError) {
        console.error('[register] Fallback upsert error:', directError);
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        return NextResponse.json(
          { error: 'Error al crear el perfil. Intenta de nuevo.' },
          { status: 500 }
        );
      }

      // Fallback exitoso — continuar normalmente
      return NextResponse.json({
        success:    true,
        hasSession: !!authData.session,
        user:       authData.user,
      });
    }

    const result = rpcResult as { success?: boolean; error?: string; message?: string };

    if (result?.error) {
      console.error('[register] Business error from RPC:', result);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      const status = result.error === 'cedula_taken' ? 409 : 500;
      return NextResponse.json({ error: result.message }, { status });
    }

    // hasSession: true → confirmación desactivada, usuario ya autenticado
    // hasSession: false → confirmación activa, debe verificar email
    return NextResponse.json({
      success:    true,
      hasSession: !!authData.session,
      user:       authData.user,
    });

  } catch (error: any) {
    console.error('[register] Unexpected error:', error);
    // Revertir auth user si fue creado antes del error
    if (authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
