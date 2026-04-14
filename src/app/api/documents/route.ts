import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function getSupabase() {
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
    const supabase = getSupabase();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const [docsResult, profileResult, categoriesResult] = await Promise.all([
      supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('profiles')
        .select('plan_type, storage_quota_bytes, storage_used_bytes')
        .eq('id', user.id)
        .single(),

      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true }),
    ]);

    const profile = profileResult.data;
    const quota = profile
      ? {
          total_bytes: profile.storage_quota_bytes,
          used_bytes: profile.storage_used_bytes,
          available_bytes: Math.max(0, profile.storage_quota_bytes - profile.storage_used_bytes),
          percentage_used: profile.storage_quota_bytes > 0
            ? (profile.storage_used_bytes / profile.storage_quota_bytes) * 100
            : 0,
          plan_type: profile.plan_type,
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

export async function DELETE(request: Request) {
  try {
    const supabase = getSupabase();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { documentId } = await request.json();
    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    // Buscar el documento para obtener el path y tamaño
    const { data: doc, error: findError } = await supabase
      .from('documents')
      .select('storage_path, file_size_bytes')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (findError || !doc) {
      return NextResponse.json({ error: 'Documento no encontrado o acceso denegado' }, { status: 404 });
    }

    // Eliminar archivo del bucket
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([doc.storage_path]);

    if (storageError) {
      console.warn('Storage delete warning:', storageError.message);
    }

    // Eliminar registro de la BD
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Liberar cuota de almacenamiento
    await supabase.rpc('free_storage', {
      p_user_id: user.id,
      p_file_size_bytes: doc.file_size_bytes,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/documents error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
