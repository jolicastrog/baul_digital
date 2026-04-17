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

    // Los datos extra viajan en options.data y el trigger on_auth_user_created
    // los lee de raw_user_meta_data para insertar el perfil automáticamente.
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

    // Delegar validación (email único, cédula única) y upsert del perfil
    // a la función de base de datos — atómico y eficiente.
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'register_user_profile',
      {
        p_user_id:           authData.user.id,
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
      // Error de conexión / permisos con la función en sí
      console.error('RPC error:', rpcError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Error al crear el perfil: ${rpcError.message}` },
        { status: 500 }
      );
    }

    const result = rpcResult as { success?: boolean; error?: string; message?: string };

    if (result?.error) {
      // La función detectó email o cédula duplicados — revertir el usuario de auth
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      const status = result.error === 'email_taken' || result.error === 'cedula_taken' ? 409 : 500;
      return NextResponse.json({ error: result.message }, { status });
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error('Register error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
