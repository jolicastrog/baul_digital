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

async function verifyCaptcha(token: string, ip?: string): Promise<boolean> {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret:   process.env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('[register] Error verificando CAPTCHA:', err);
    return false;
  }
}

export async function POST(request: Request) {
  let authUserId: string | null = null;

  try {
    const body = await request.json();
    const { email, password, nombres, apellidos, cedulaUnica, cedulaTipo, acceptedTerms, captchaToken } = body;

    if (!email || !password || !nombres || !apellidos || !cedulaUnica || !cedulaTipo) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    if (!acceptedTerms) {
      return NextResponse.json(
        { error: 'Debes aceptar los Términos y la Política de Privacidad para registrarte.' },
        { status: 400 }
      );
    }

    // ── Verificar CAPTCHA (Cloudflare Turnstile) ─────────────────────────────
    if (!captchaToken) {
      return NextResponse.json({ error: 'Completa la verificación de seguridad.' }, { status: 400 });
    }
    const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? undefined;
    const captchaOk = await verifyCaptcha(captchaToken, ip ?? undefined);
    if (!captchaOk) {
      return NextResponse.json({ error: 'Verificación de seguridad inválida. Intenta de nuevo.' }, { status: 400 });
    }

    const cedulaNorm = cedulaUnica.trim();

    // ── PASO 0: Validar que el tipo de documento esté habilitado ─────────────
    const { data: docType } = await supabaseAdmin
      .from('document_types')
      .select('code')
      .eq('code', cedulaTipo)
      .eq('is_active', true)
      .maybeSingle();

    if (!docType) {
      return NextResponse.json(
        { error: 'El tipo de documento seleccionado no está habilitado para registro.' },
        { status: 400 }
      );
    }

    // ── PASO 1: Validar cédula y email en la BD (única fuente de verdad) ──────
    // validate_registration es una función SECURITY DEFINER que verifica
    // duplicados en profiles. Si falla o retorna ok=false → rechazar.
    const { data: validation, error: validationError } = await supabaseAdmin
      .rpc('validate_registration', {
        p_cedula: cedulaNorm,
        p_email:  email.trim().toLowerCase(),
      });

    if (validationError) {
      console.error('[register] Error llamando validate_registration:', validationError);
      return NextResponse.json(
        { error: 'Error al validar los datos. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    if (!validation?.ok) {
      return NextResponse.json(
        { error: validation?.message ?? 'Datos ya registrados.' },
        { status: 409 }
      );
    }

    // ── PASO 2: Crear usuario en Supabase Auth ───────────────────────────────
    // El trigger handle_new_user → setup_new_user crea el perfil y categorías.
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appUrl}/auth/confirm`,
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

    authUserId = authData.user.id;

    // ── PASO 3: Verificar que el trigger creó el perfil ───────────────────────
    // Esperar a que el trigger handle_new_user → setup_new_user termine.
    await new Promise(resolve => setTimeout(resolve, 500));

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', authUserId)
      .maybeSingle();

    if (!profile) {
      // El trigger no creó el perfil — revertir el auth user para no dejar huérfanos
      console.error('[register] Perfil no encontrado tras signUp, revirtiendo auth user:', authUserId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return NextResponse.json(
        { error: 'Error al crear el perfil. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    // ── PASO 4: Completar datos del perfil (términos, datos completos) ────────
    // El trigger crea el perfil con datos básicos del metadata de auth.
    // Aquí actualizamos accepted_terms_at y nos aseguramos de que los datos
    // coincidan exactamente con lo que el usuario ingresó en el formulario.
    const { error: termsError } = await supabaseAdmin
      .from('profiles')
      .update({
        nombres:           nombres.trim(),
        apellidos:         apellidos.trim(),
        full_name:         `${nombres.trim()} ${apellidos.trim()}`,
        cedula_unica:      cedulaNorm,
        cedula_tipo:       cedulaTipo,
        accepted_terms_at: new Date().toISOString(),
        terms_version:     '1.0',
      })
      .eq('id', authUserId);

    if (termsError) {
      console.error('[register] Error actualizando términos en perfil:', termsError);
      // No es fatal — el perfil existe, el usuario puede ingresar al sistema
    }

    return NextResponse.json({
      success:    true,
      hasSession: !!authData.session,
      user:       authData.user,
    });

  } catch (error: any) {
    console.error('[register] Error inesperado:', error);
    if (authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
