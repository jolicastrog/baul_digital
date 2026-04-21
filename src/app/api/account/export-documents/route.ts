import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
// ZIP puede tardar en generarse para cuentas con muchos archivos
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKET = 'documents';

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

// GET — descarga un ZIP con todos los documentos del usuario
export async function GET() {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: documents, error: docsError } = await supabaseAdmin
      .from('documents')
      .select('id, file_name, storage_path, file_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('[export-documents] DB error:', docsError);
      return NextResponse.json({ error: 'Error al obtener documentos.' }, { status: 500 });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'No tienes documentos para exportar.' }, { status: 404 });
    }

    const zip = new JSZip();

    // Descargar archivos en lotes de 10 para no saturar el storage
    const BATCH = 10;
    const usedNames = new Map<string, number>();

    for (let i = 0; i < documents.length; i += BATCH) {
      const batch = documents.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (doc) => {
          try {
            const { data, error } = await supabaseAdmin.storage
              .from(STORAGE_BUCKET)
              .download(doc.storage_path);

            if (error || !data) return;

            // Evitar nombres duplicados en el ZIP
            const base  = doc.file_name;
            const count = usedNames.get(base) ?? 0;
            const name  = count === 0 ? base : `${base.replace(/(\.[^.]+)$/, '')}_${count}$1`;
            usedNames.set(base, count + 1);

            const buffer = await data.arrayBuffer();
            zip.file(name, buffer);
          } catch {
            // Si un archivo falla, continúa con los demás
          }
        })
      );
    }

    const zipBuffer = await zip.generateAsync({
      type:               'nodebuffer',
      compression:        'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const date     = new Date().toISOString().slice(0, 10);
    const filename = `baul-digital-${date}.zip`;

    return new Response(zipBuffer, {
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(zipBuffer.length),
      },
    });
  } catch (err) {
    console.error('[export-documents] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
