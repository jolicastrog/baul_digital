import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// Cliente admin — bypasea RLS para operaciones del servidor
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

export async function GET(_request: Request) {
  try {
    const supabase = getAnonSupabase();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const [docsResult, profileResult, categoriesResult] = await Promise.all([
      supabaseAdmin
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      supabaseAdmin
        .from('profiles')
        .select('plan_type, storage_quota_bytes, storage_used_bytes')
        .eq('id', user.id)
        .single(),

      supabaseAdmin
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true }),
    ]);

    const profile = profileResult.data;

    // Obtener límite de documentos desde la tabla plans (fuente de verdad)
    const planResult = profile
      ? await supabaseAdmin
          .from('plans')
          .select('max_documents, max_file_size_mb')
          .eq('code', profile.plan_type)
          .single()
      : null;

    const maxDocuments: number | null = planResult?.data?.max_documents ?? null;

    const quota = profile
      ? {
          total_bytes: profile.storage_quota_bytes,
          used_bytes: profile.storage_used_bytes,
          available_bytes: Math.max(0, profile.storage_quota_bytes - profile.storage_used_bytes),
          percentage_used: profile.storage_quota_bytes > 0
            ? (profile.storage_used_bytes / profile.storage_quota_bytes) * 100
            : 0,
          plan_type: profile.plan_type,
          max_documents: maxDocuments,
        }
      : null;

    return NextResponse.json({
      success: true,
      documents: docsResult.data ?? [],
      quota,
      categories: categoriesResult.data ?? [],
    });
  } catch (err: any) {
    console.error('GET /api/documents error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — actualizar metadatos de un documento (fecha de caducidad, etc.)
export async function PATCH(request: Request) {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { documentId, expiry_date } = await request.json();
    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    // Verificar que el documento pertenece al usuario
    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('user_id')
      .eq('id', documentId)
      .single();

    if (!doc || doc.user_id !== user.id) {
      return NextResponse.json({ error: 'Documento no encontrado o acceso denegado' }, { status: 404 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('documents')
      .update({ expiry_date: expiry_date ?? null })
      .eq('id', documentId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: updated });
  } catch (err: any) {
    console.error('PATCH /api/documents error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = getAnonSupabase();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { documentId } = await request.json();
    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    // Buscar el documento — verificar que pertenece al usuario
    const { data: doc, error: findError } = await supabaseAdmin
      .from('documents')
      .select('storage_path, file_size_bytes, user_id')
      .eq('id', documentId)
      .single();

    if (findError || !doc || doc.user_id !== user.id) {
      return NextResponse.json({ error: 'Documento no encontrado o acceso denegado' }, { status: 404 });
    }

    // Eliminar archivo del bucket
    const { error: storageError } = await supabaseAdmin.storage
      .from('documents')
      .remove([doc.storage_path]);

    if (storageError) {
      console.warn('Storage delete warning:', storageError.message);
    }

    // Eliminar registro de la BD
    const { error: deleteError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Liberar cuota de almacenamiento
    await supabaseAdmin.rpc('free_storage', {
      p_user_id: user.id,
      p_file_size_bytes: doc.file_size_bytes,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/documents error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
