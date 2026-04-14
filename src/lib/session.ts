import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDatabaseClient } from '@/lib/database';

const isProduction = process.env.NEXT_PUBLIC_APP_ENV === 'production';
const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'supabase';

/**
 * Hook para obtener la sesión del usuario en Client Components / Server Actions
 * (Node.js runtime required)
 */
export async function getServerSession() {
  const cookieStore = await cookies();

  if (storageType === 'local' || !isProduction) {
    // MODO LOCAL
    const localSession = cookieStore.get('baul_local_session')?.value;
    if (!localSession) return null;

    try {
      const client = getDatabaseClient();
      const result = await client.query('SELECT * FROM profiles WHERE id = $1', [localSession]);
      if (result.rows.length === 0) return null;
      
      const profile = result.rows[0];
      return {
        user: { id: profile.id, email: profile.email },
        profile,
      };
    } catch (error) {
      console.error('Error fetching local session:', error);
      return null;
    }
  }

  // MODO SUPABASE
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set(name, value, options); },
        remove(name: string, options: CookieOptions) { cookieStore.delete(name); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  return { user, profile };
}

export async function isAdminUser(): Promise<boolean> {
  const session = await getServerSession();
  if (!session) return false;
  return session.profile?.plan_type === 'enterprise';
}

export async function requireAdmin() {
  const isAdmin = await isAdminUser();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }
}

export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Authentication required.' }, { status: 401 });
  }
  return session;
}
