import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const cedulaNorm = cedulaUnica.trim();

    // ── Verificar cédula única antes de crear el auth user ───────────────────
    const { data: existingCedula } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('cedula_unica', cedulaNorm)
      .not('cedula_unica', 'like', 'TEMP_%')
      .maybeSingle();

    if (existingCedula) {
      return NextResponse.json(
        { error: 'Ese número de documento ya está registrado en otra cuenta.' },
        { status: 409 }
      );
    }

    // ── Crear usuario en Supabase Auth ───────────────────────────────────────
    // El trigger handle_new_user → setup_new_user crea el perfil y categorías
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
          cedula_unica: cedulaNorm,
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

    // ── Actualizar accepted_terms_at en el perfil creado por el trigger ──────
    // El trigger crea el perfil con datos básicos; aquí completamos los campos
    // de términos y legales que no vienen del metadata de auth.
    await new Promise(resolve => setTimeout(resolve, 500));

    const { error: termsError } = await supabaseAdmin
      .from('profiles')
      .update({
        accepted_terms_at: new Date().toISOString(),
        terms_version:     '1.0',
        cedula_unica:      cedulaNorm,
        cedula_tipo:       cedulaTipo,
        nombres:           nombres.trim(),
        apellidos:         apellidos.trim(),
        full_name:         `${nombres.trim()} ${apellidos.trim()}`,
      })
      .eq('id', authData.user.id);

    if (termsError) {
      console.error('[register] No se pudo actualizar términos en el perfil:', termsError);
    }

    return NextResponse.json({
      success:    true,
      hasSession: !!authData.session,
      user:       authData.user,
    });

  } catch (error: any) {
    console.error('[register] Error inesperado:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
