import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const LOGIN_ERROR_ES: Record<string, string> = {
  'Invalid login credentials':
    'Correo o contraseña incorrectos. Verifica tus datos.',
  'Email not confirmed':
    'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
  'Invalid email or password':
    'Correo o contraseña incorrectos. Verifica tus datos.',
  'Too many requests':
    'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'El correo y la contraseña son requeridos.' }, { status: 400 });
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = LOGIN_ERROR_ES[error.message] ?? 'Error al iniciar sesión. Intenta de nuevo.';
      if (error.message === 'Email not confirmed') {
        return NextResponse.json({ error: msg, code: 'email_not_confirmed' }, { status: 401 });
      }
      return NextResponse.json({ error: msg }, { status: 401 });
    }

    return NextResponse.json({ success: true, user: data.user });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
