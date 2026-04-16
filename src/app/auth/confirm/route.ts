import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type       = searchParams.get('type') as EmailOtpType | null;

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL('/login?error=enlace_invalido', request.url)
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

  const { error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    console.error('Email confirm error:', error.message);
    return NextResponse.redirect(
      new URL(`/login?error=confirmacion_fallida`, request.url)
    );
  }

  // Confirmación exitosa → redirigir al login con mensaje de éxito
  return NextResponse.redirect(new URL('/login?msg=confirmado', request.url));
}
