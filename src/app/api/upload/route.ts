import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const STORAGE_BUCKET = 'documents';
const SIGNED_URL_EXPIRY = 15 * 60; // 15 minutos

// Cliente con anon key — solo para verificar la sesión del usuario
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

// Cliente admin con service role — bypasea RLS para operaciones del servidor
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // Verificar sesión del usuario con el cliente anon (lee cookies)
    const supabaseAuth = getAnonSupabase();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const categoryId = formData.get('categoryId') as string | null;
    const expiryDate = formData.get('expiryDate') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }

    // 1. Verificar cuota de almacenamiento (admin bypasa RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('storage_quota_bytes, storage_used_bytes')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile query error:', profileError);
      return NextResponse.json({
        error: 'No se encontró el perfil del usuario',
        detail: profileError?.message ?? 'profile is null',
        code: profileError?.code,
        user_id: user.id,
      }, { status: 400 });
    }

    const available = profile.storage_quota_bytes - profile.storage_used_bytes;
    if (file.size > available) {
      return NextResponse.json({
        error: `Sin espacio disponible. Disponible: ${(available / 1024 / 1024).toFixed(1)}MB`
      }, { status: 400 });
    }

    // 2. Obtener nombre de categoría para el path
    let categoryName = 'Otros';
    if (categoryId) {
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('name')
        .eq('id', categoryId)
        .single();
      if (cat) categoryName = cat.name;
    }

    // 3. Generar ruta: {userId}/{categoria}/{uuid}.ext
    // Normalizar categoría: quitar tildes y caracteres especiales
    const safeCategoryName = categoryName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // quita tildes
      .replace(/[^a-zA-Z0-9_-]/g, '_')  // reemplaza todo lo demás por _
      .toLowerCase();
    const ext = file.name.split('.').pop() || '';
    const uuid = crypto.randomUUID();
    const storagePath = `${user.id}/${safeCategoryName}/${uuid}.${ext}`;

    // 4. Subir archivo a Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Error al subir el archivo: ' + uploadError.message }, { status: 500 });
    }

    // 5. Crear registro en documentos
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        user_id: user.id,
        category_id: categoryId || null,
        file_name: file.name,
        file_size_bytes: file.size,
        file_type: file.type,
        storage_path: storagePath,
        expiry_date: expiryDate || null,
        tags: [],
        access_level: 'private',
      })
      .select()
      .single();

    if (dbError) {
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
      console.error('DB insert error:', dbError);
      return NextResponse.json({ error: 'Error al registrar el documento: ' + dbError.message }, { status: 500 });
    }

    // 6. Actualizar storage usado
    await supabaseAdmin.rpc('update_storage_used', {
      p_user_id: user.id,
      p_file_size_bytes: file.size,
    });

    // 7. Signed URL para previsualizar
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

    // 8. Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'DOCUMENT_UPLOADED',
      resource_type: 'document',
      resource_id: document.id,
      details: { file_name: file.name, file_size: file.size, category: categoryName },
    });

    return NextResponse.json({
      success: true,
      document,
      signedUrl: signedUrlData?.signedUrl,
    });
  } catch (err: any) {
    console.error('POST /api/upload error:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
