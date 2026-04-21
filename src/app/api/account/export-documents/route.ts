import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

export const dynamic  = 'force-dynamic';
export const maxDuration = 60;

const supabaseAdmin  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const STORAGE_BUCKET = 'documents';
const SIGNED_EXPIRY  = 300; // 5 min — solo para descarga interna

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

export async function GET() {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: documents, error: docsError } = await supabaseAdmin
      .from('documents')
      .select('id, file_name, storage_path, file_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('[export-documents] DB error:', docsError);
      return NextResponse.json({ error: 'Error al obtener documentos.' }, { status: 500 });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'No tienes documentos para exportar.' }, { status: 404 });
    }

    const zip      = new JSZip();
    const usedNames = new Map<string, number>();
    const BATCH    = 5; // lotes pequeños para no saturar

    for (let i = 0; i < documents.length; i += BATCH) {
      const batch = documents.slice(i, i + BATCH);

      await Promise.all(batch.map(async (doc) => {
        try {
          // 1. Generar URL firmada
          const { data: signed, error: signErr } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(doc.storage_path, SIGNED_EXPIRY);

          if (signErr || !signed?.signedUrl) return;

          // 2. Descargar el archivo real vía HTTP
          const fileRes = await fetch(signed.signedUrl);
          if (!fileRes.ok) return;

          // 3. Verificar que no sea respuesta JSON de error
          const contentType = fileRes.headers.get('content-type') ?? '';
          if (contentType.includes('application/json')) return;

          const buffer = await fileRes.arrayBuffer();
          if (buffer.byteLength === 0) return;

          // 4. Nombre único en el ZIP
          const baseName = doc.file_name;
          const count    = usedNames.get(baseName) ?? 0;
          const zipName  = count === 0
            ? baseName
            : baseName.replace(/(\.[^.]+)$/, `_${count}$1`);
          usedNames.set(baseName, count + 1);

          zip.file(zipName, buffer);
        } catch {
          // archivo fallido: continuar con los demás
        }
      }));
    }

    const fileCount = Object.keys(zip.files).length;
    if (fileCount === 0) {
      return NextResponse.json({ error: 'No se pudo acceder a los archivos.' }, { status: 500 });
    }

    const zipBuffer = await zip.generateAsync({
      type:               'nodebuffer',
      compression:        'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const date     = new Date().toISOString().slice(0, 10);
    const filename = `baul-digital-${date}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
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
