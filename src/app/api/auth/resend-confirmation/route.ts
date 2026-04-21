import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const RATE_LIMIT_PHRASES = [
  'rate limit',
  '60 seconds',
  'over_email_send_rate_limit',
  'Email rate limit exceeded',
];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email: string | undefined = body?.email?.trim();

    if (!email) {
      return NextResponse.json({ error: 'El correo es requerido.' }, { status: 400 });
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

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
      },
    });

    if (error) {
      const isRateLimit = RATE_LIMIT_PHRASES.some(p =>
        error.message.toLowerCase().includes(p.toLowerCase())
      );
      if (isRateLimit) {
        return NextResponse.json(
          { error: 'Por seguridad, espera 60 segundos antes de volver a solicitar el enlace.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'No se pudo reenviar el correo. Intenta de nuevo.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
