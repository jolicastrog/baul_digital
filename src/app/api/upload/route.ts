import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getRequestMeta } from '@/lib/utils/requestMeta';

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
    const expiryNote = formData.get('expiryNote') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }

    // 1. Verificar cuota y límites del plan
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('storage_quota_bytes, storage_used_bytes, plan_type')
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

    // Obtener límites del plan desde la tabla plans
    const { data: planData } = await supabaseAdmin
      .from('plans')
      .select('allow_media_files, max_file_size_mb')
      .eq('code', profile.plan_type)
      .single();

    const allowMediaFiles = planData?.allow_media_files ?? false;
    const maxFileSizeMb   = planData?.max_file_size_mb   ?? 10;

    // Validar tipo de archivo: MP3/MP4 solo en planes con allowMedia
    const MEDIA_TYPES = ['audio/mpeg', 'video/mp4'];
    if (MEDIA_TYPES.includes(file.type) && !allowMediaFiles) {
      return NextResponse.json({
        error: 'Tu plan no permite subir archivos de audio o video. Actualiza a Premium o Empresarial para habilitarlo.',
      }, { status: 400 });
    }

    // Validar tamaño máximo según plan
    if (file.size > maxFileSizeMb * 1024 * 1024) {
      return NextResponse.json({
        error: `El archivo excede el límite de ${maxFileSizeMb} MB permitido en tu plan.`,
      }, { status: 400 });
    }

    const available = profile.storage_quota_bytes - profile.storage_used_bytes;
    if (file.size > available) {
      return NextResponse.json({
        error: `Sin espacio disponible. Disponible: ${(available / 1024 / 1024).toFixed(1)}MB`
      }, { status: 400 });
    }

    // 2. Verificar nombre de archivo duplicado para este usuario
    const { data: existing } = await supabaseAdmin
      .from('documents')
      .select('id')
      .eq('user_id', user.id)
      .eq('file_name', file.name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: `Ya tienes un archivo con el nombre "${file.name}". Renómbralo antes de subir o elimina el existente.`
      }, { status: 409 });
    }

    // 3. Obtener nombre de categoría para el path
    let categoryName = 'Otros';
    if (categoryId) {
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('name')
        .eq('id', categoryId)
        .single();
      if (cat) categoryName = cat.name;
    }

    // 4. Generar ruta: {userId}/{categoria}/{uuid}.ext
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
        expiry_note: expiryNote || null,
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
    const { ip_address, user_agent } = getRequestMeta(request);
    await supabaseAdmin.from('audit_logs').insert({
      user_id:       user.id,
      action:        'DOCUMENT_UPLOADED',
      resource_type: 'document',
      resource_id:   document.id,
      ip_address,
      user_agent,
      details:       { file_name: file.name, file_size: file.size, category: categoryName },
      retain_until:  new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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
