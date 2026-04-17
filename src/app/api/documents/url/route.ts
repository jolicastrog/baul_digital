import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

const SIGNED_URL_EXPIRY = 15 * 60; // 15 minutos
const STORAGE_BUCKET    = 'documents';

export async function GET(request: NextRequest) {
  try {
    // 1. Verificar sesión
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 2. Obtener el ID del documento desde query params
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');
    if (!documentId) {
      return NextResponse.json({ error: 'ID de documento requerido' }, { status: 400 });
    }

    // 3. Verificar que el documento pertenece al usuario
    const { data: document } = await supabaseAdmin
      .from('documents')
      .select('storage_path, file_name, user_id')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // 4. Generar URL firmada (15 min)
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(document.storage_path, SIGNED_URL_EXPIRY);

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json({ error: 'No se pudo generar la URL' }, { status: 500 });
    }

    // 5. Registrar acceso en audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action:        'DOCUMENT_VIEWED',
      resource_type: 'document',
      resource_id:   documentId,
    });

    return NextResponse.json({ url: signedData.signedUrl });

  } catch (error) {
    console.error('URL route error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
