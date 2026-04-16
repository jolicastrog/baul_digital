import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Verificar si el email ya está registrado
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Este correo electrónico ya está registrado. Intenta iniciar sesión.' },
        { status: 409 }
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
          cedula_unica: cedulaUnica,
          cedula_tipo:  cedulaTipo,
        },
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Registrar fecha y versión de aceptación de términos (Ley 1581/2012)
    if (authData.user) {
      await supabaseAdmin
        .from('profiles')
        .update({
          accepted_terms_at: new Date().toISOString(),
          terms_version:     '1.0',
        })
        .eq('id', authData.user.id);
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error('Register error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
