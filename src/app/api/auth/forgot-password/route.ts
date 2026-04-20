import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'El correo es requerido.' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

    // Siempre responder con éxito para no revelar si el correo existe
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${appUrl}/auth/confirm?type=recovery`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[forgot-password] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
