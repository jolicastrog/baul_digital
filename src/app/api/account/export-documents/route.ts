import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SIGNED_URL_EXPIRY = 60 * 60; // 1 hora para descarga masiva
const STORAGE_BUCKET    = 'documents';

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

// GET — retorna lista de documentos con URLs firmadas (1h) para descarga
export async function GET() {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Obtener todos los documentos del usuario
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('documents')
      .select('id, file_name, storage_path, file_type, expiry_date, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('[export-documents] DB error:', docsError);
      return NextResponse.json({ error: 'Error al obtener documentos.' }, { status: 500 });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ success: true, documents: [] });
    }

    // Generar URLs firmadas en paralelo (máximo 50 a la vez para no saturar)
    const BATCH = 50;
    const result: Array<{
      id: string;
      file_name: string;
      file_type: string;
      expiry_date: string | null;
      description: string | null;
      created_at: string;
      download_url: string | null;
    }> = [];

    for (let i = 0; i < documents.length; i += BATCH) {
      const batch = documents.slice(i, i + BATCH);
      const signed = await Promise.all(
        batch.map(async (doc) => {
          const { data: signedData } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRY);
          return {
            id:          doc.id,
            file_name:   doc.file_name,
            file_type:   doc.file_type,
            expiry_date: doc.expiry_date ?? null,
            description: doc.description ?? null,
            created_at:  doc.created_at,
            download_url: signedData?.signedUrl ?? null,
          };
        })
      );
      result.push(...signed);
    }

    return NextResponse.json({
      success:   true,
      count:     result.length,
      documents: result,
    });
  } catch (err) {
    console.error('[export-documents] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
