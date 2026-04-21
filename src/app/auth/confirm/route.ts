import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type       = searchParams.get('type') as EmailOtpType | null;
  const code       = searchParams.get('code');

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Flujo OTP (token_hash + type) — email confirmation, magic link
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(
        type === 'recovery' ? '/reset-password' : '/login?msg=confirmado',
        request.url
      ));
    }
  }

  // Flujo PKCE (code)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const isRecovery = data?.user?.aud === 'authenticated' &&
        searchParams.get('type') === 'recovery';
      return NextResponse.redirect(new URL(
        isRecovery ? '/reset-password' : '/login?msg=confirmado',
        request.url
      ));
    }
  }

  return NextResponse.redirect(new URL('/login?error=confirmacion_fallida', request.url));
}
