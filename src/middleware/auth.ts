import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const publicRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/auth/confirm',
  '/privacidad',
  '/terminos',
];

/**
 * Middleware de autenticación para Next.js (Edge Runtime).
 * IMPORTANTE: No usar cookies() de next/headers aquí — no está disponible en Edge.
 * Se usa request.cookies y supabaseResponse.cookies en su lugar.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca la sesión — IMPORTANTE: no eliminar este llamado
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Token de refresco inválido (sesión expirada o cookies corruptas).
  // Limpiar cookies sb-* y redirigir a login para que el usuario vuelva a autenticarse.
  if (authError?.code === 'refresh_token_not_found') {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    request.cookies.getAll()
      .filter(c => c.name.startsWith('sb-'))
      .forEach(c => response.cookies.delete(c.name));
    return response;
  }

  const isPublicRoute =
    publicRoutes.some((r) => request.nextUrl.pathname.startsWith(r)) ||
    request.nextUrl.pathname === '/';

  if (!user && !isPublicRoute && !request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}
