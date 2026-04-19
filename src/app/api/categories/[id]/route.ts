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

// PATCH — renombrar / actualizar color de categoría
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

    const { name, color_code } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    }

    // Verificar propiedad
    const { data: existing } = await supabaseAdmin
      .from('categories')
      .select('user_id, is_default')
      .eq('id', params.id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Categoría no encontrada.' }, { status: 404 });
    }

    if (existing.is_default) {
      return NextResponse.json(
        { error: 'Las categorías por defecto no se pueden modificar.' },
        { status: 403 }
      );
    }

    const updates: any = { name: name.trim() };
    if (color_code) updates.color_code = color_code;

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
        return NextResponse.json({ error: 'Ya tienes una categoría con ese nombre.' }, { status: 409 });
      }
      if (error.message.includes('DEFAULT_CATEGORY_PROTECTED')) {
        return NextResponse.json({ error: 'Las categorías por defecto no se pueden modificar.' }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — mover todos los documentos de esta categoría a otra
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { target_category_id } = await request.json();

    const { error } = await supabaseAdmin.rpc('move_category_documents', {
      p_from_category_id: params.id,
      p_to_category_id:   target_category_id ?? null,
      p_user_id:          user.id,
    });

    if (error) {
      const msg = error.message;
      if (msg.includes('CATEGORY_NOT_FOUND'))
        return NextResponse.json({ error: 'Categoría no encontrada.' }, { status: 404 });
      if (msg.includes('CATEGORY_OWNERSHIP_VIOLATION'))
        return NextResponse.json({ error: 'La categoría destino no te pertenece.' }, { status: 403 });
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — eliminar categoría via función de BD
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { error } = await supabaseAdmin.rpc('delete_category', {
      p_category_id: params.id,
      p_user_id:     user.id,
    });

    if (error) {
      const msg = error.message;
      if (msg.includes('CATEGORY_HAS_DOCUMENTS')) {
        return NextResponse.json(
          { error: msg.split('CATEGORY_HAS_DOCUMENTS: ')[1] ?? msg },
          { status: 409 }
        );
      }
      if (msg.includes('DEFAULT_CATEGORY_PROTECTED')) {
        return NextResponse.json(
          { error: 'Las categorías por defecto no se pueden eliminar.' },
          { status: 403 }
        );
      }
      if (msg.includes('CATEGORY_NOT_FOUND')) {
        return NextResponse.json({ error: 'Categoría no encontrada.' }, { status: 404 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
