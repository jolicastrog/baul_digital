import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getAnonSupabase() {
  const cookieStore = cookies();
  return createServerClient(
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
}

// PATCH — mover documento a otra categoría
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { category_id } = await request.json();

    const { error } = await supabaseAdmin.rpc('move_document_to_category', {
      p_document_id:     params.id,
      p_user_id:         user.id,
      p_new_category_id: category_id ?? null,
    });

    if (error) {
      const msg = error.message;
      if (msg.includes('DOCUMENT_NOT_FOUND'))
        return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
      if (msg.includes('CATEGORY_OWNERSHIP_VIOLATION'))
        return NextResponse.json({ error: 'La categoría no te pertenece.' }, { status: 403 });
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
