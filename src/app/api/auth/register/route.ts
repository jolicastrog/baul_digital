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

    // Verificar email único — buscamos en auth.users (incluye usuarios sin confirmar)
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailLower = email.trim().toLowerCase();
    const emailTaken = authList?.users?.some(u => u.email?.toLowerCase() === emailLower);
    if (emailTaken) {
      return NextResponse.json(
        { error: 'Este correo electrónico ya está registrado. Intenta iniciar sesión.' },
        { status: 409 }
      );
    }

    // Verificar cédula única — buscamos en auth.users metadata (incluye usuarios sin confirmar)
    // y también en profiles (usuarios ya confirmados)
    const cedulaNorm = cedulaUnica.trim();
    const cedulaTakenInMeta = authList?.users?.some(
      u => u.user_metadata?.cedula_unica === cedulaNorm
    );
    if (cedulaTakenInMeta) {
      return NextResponse.json(
        { error: 'Ese número de documento ya está registrado en otra cuenta.' },
        { status: 409 }
      );
    }

    const { data: existingCedula } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('cedula_unica', cedulaNorm)
      .maybeSingle();
    if (existingCedula) {
      return NextResponse.json(
        { error: 'Ese número de documento ya está registrado en otra cuenta.' },
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
          full_name:    `${nombres.trim()} ${apellidos.trim()}`,
          cedula_unica: cedulaUnica,
          cedula_tipo:  cedulaTipo,
        },
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (authData.user) {
      // Upsert manual del perfil: respaldo si el trigger falla + registra consentimiento
      const { error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id:                authData.user.id,
          email:             email.trim().toLowerCase(),
          nombres:           nombres.trim(),
          apellidos:         apellidos.trim(),
          full_name:         `${nombres.trim()} ${apellidos.trim()}`,
          cedula_unica:      cedulaUnica.trim(),
          cedula_tipo:       cedulaTipo,
          accepted_terms_at: new Date().toISOString(),
          terms_version:     '1.0',
        }, { onConflict: 'id' });

      if (upsertError) {
        console.error('Profile upsert error:', upsertError);

        // Revertir: eliminar el usuario de auth para no dejar registros huérfanos
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

        // Cédula duplicada
        if (upsertError.code === '23505') {
          return NextResponse.json(
            { error: 'Ese número de documento ya está registrado en otra cuenta.' },
            { status: 409 }
          );
        }

        return NextResponse.json(
          { error: `Error al crear el perfil: ${upsertError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error('Register error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
