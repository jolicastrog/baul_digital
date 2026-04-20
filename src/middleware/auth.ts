import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// Cliente service_role para verificar is_admin — bypasea RLS, solo se usa en servidor
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const publicRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/confirm',
  '/privacidad',
  '/terminos',
];

/**
 * Middleware de autenticación para Next.js (Edge Runtime).
 * IMPORTANTE: No usar cookies() de next/headers aquí — no está disponible en Edge.
 * Se usa request.cookies y supabaseResponse.cookies en su lugar.
 *
 * Rutas /admin/*:
 *   - Sin sesión   → redirige a /login
 *   - Sin is_admin → redirige a /dashboard (acceso denegado silencioso)
 *   - Con is_admin → deja pasar
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

  const { pathname } = request.nextUrl;

  const isPublicRoute =
    publicRoutes.some((r) => pathname.startsWith(r)) ||
    pathname === '/';

  // ── Rutas /admin/* ────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return supabaseResponse;
  }

  // ── Rutas protegidas generales ────────────────────────────────────────────
  if (!user && !isPublicRoute && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}
