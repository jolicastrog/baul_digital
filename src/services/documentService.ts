import { getSupabaseClient } from '@/lib/supabase';
import {
  Document,
  DocumentUploadPayload,
  StorageQuotaInfo,
  UploadResult,
  PlanType,
} from '@/types';
import {
  generateStoragePath,
  processFile,
  formatBytes,
} from '@/utils/fileValidation';

const STORAGE_BUCKET = 'documents';
const SIGNED_URL_EXPIRY = 15 * 60; // 15 minutos

const isProduction = process.env.NEXT_PUBLIC_APP_ENV === 'production';
const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'supabase';

/**
 * Obtiene información de cuota de almacenamiento del usuario
 */
export async function getStorageQuota(userId: string): Promise<StorageQuotaInfo> {
  if (storageType === 'local' || !isProduction) {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        return data.quota;
      }
    } catch (e) {
      console.error('Error fetching local quota');
    }
    return {
      total_bytes: 5368709120, // 5GB fallback
      used_bytes: 0,
      available_bytes: 5368709120,
      percentage_used: 0,
      plan_type: 'free',
    };
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('storage_quota_bytes, storage_used_bytes, plan_type')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching storage quota:', error);
    throw new Error('No se pudo obtener información de almacenamiento.');
  }

  const total_bytes = data.storage_quota_bytes;
  const used_bytes = data.storage_used_bytes;
  const available_bytes = Math.max(0, total_bytes - used_bytes);

  return {
    total_bytes,
    used_bytes,
    available_bytes,
    percentage_used: (used_bytes / total_bytes) * 100,
    plan_type: data.plan_type as PlanType,
  };
}

/**
 * Verifica si el usuario tiene espacio disponible para subir un archivo
 */
export async function canUploadFile(userId: string, fileSizeBytes: number): Promise<boolean> {
  const quota = await getStorageQuota(userId);
  return fileSizeBytes <= quota.available_bytes;
}

/**
 * Sube un documento a Supabase Storage y crea registro en BD o a través del endpoint local
 */
export async function uploadDocument(
  userId: string,
  payload: DocumentUploadPayload
): Promise<UploadResult> {
  if (storageType === 'local' || !isProduction) {
    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.category_id) formData.append('categoryId', payload.category_id);
    if (payload.expiry_date) formData.append('expiryDate', payload.expiry_date.toISOString().split('T')[0]);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Error local al subir archivo' };
      }
      return { success: true, document: data.document };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error local' };
    }
  }

  const supabase = getSupabaseClient();

  try {
    // 1. Procesar archivo (validación y compresión)
    const processedFile = await processFile(payload.file);

    // 2. Verificar cuota disponible
    const canUpload = await canUploadFile(userId, processedFile.size);
    if (!canUpload) {
      const quota = await getStorageQuota(userId);
      return {
        success: false,
        error: `No hay suficiente espacio. Disponible: ${formatBytes(quota.available_bytes)}`,
      };
    }

    // 3. Obtener datos de categoría si existe
    let categoryName = 'Otros';
    if (payload.category_id) {
      const { data: category } = await supabase
        .from('categories')
        .select('name')
        .eq('id', payload.category_id)
        .single();

      if (category) {
        categoryName = category.name;
      }
    }

    // 4. Generar ruta de almacenamiento
    const storagePath = generateStoragePath(userId, categoryName, processedFile.name);

    // 5. Subir archivo a Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, processedFile, {
        cacheControl: '31536000', // 1 año
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return {
        success: false,
        error: 'Error al subir el archivo. Por favor, intenta de nuevo.',
      };
    }

    // 6. Crear registro en base de datos
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        category_id: payload.category_id || null,
        file_name: processedFile.name,
        file_size_bytes: processedFile.size,
        file_type: processedFile.type,
        storage_path: storagePath,
        description: payload.description || null,
        expiry_date: payload.expiry_date ? payload.expiry_date.toISOString().split('T')[0] : null,
        tags: payload.tags || [],
        access_level: payload.access_level || 'private',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Intenta eliminar el archivo si falla inserción en BD
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return {
        success: false,
        error: 'Error al registrar el documento. Por favor, intenta de nuevo.',
      };
    }

    // 7. Actualizar storage usado en perfil
    await supabase.rpc('update_storage_used', {
      p_user_id: userId,
      p_file_size_bytes: processedFile.size,
    });

    // 8. Generar signed URL para descargar
    const { data: signedUrlData } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

    // 9. Registrar en audit log
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'DOCUMENT_UPLOADED',
      resource_type: 'document',
      resource_id: document.id,
      details: {
        file_name: processedFile.name,
        file_size: processedFile.size,
        category: categoryName,
      },
    });

    return {
      success: true,
      document: document as Document,
      signedUrl: signedUrlData?.signedUrl,
    };
  } catch (error) {
    console.error('Upload document error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al subir el documento.',
    };
  }
}

/**
 * Descarga un documento 
 */
export async function getDownloadUrl(
  userId: string,
  documentId: string
): Promise<{ url: string | null; error?: string }> {
  if (storageType === 'local' || !isProduction) {
    // Si la ruta arranca como /uploads/ (almacenado local) podemos devolverla directo
    // Pero si queremos autenticación tendríamos que devolver una API route que reenvie el buffer.
    // Por simplicidad en MVP local (al estar en la pc), sólo le sugeriremos que mire public/uploads
    return { url: null, error: 'En desarrollo local los archivos están en carpeta public/uploads' };
  }

  const supabase = getSupabaseClient();

  try {
    const { data: document } = await supabase
      .from('documents')
      .select('storage_path, user_id')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (!document) {
      return { url: null, error: 'Documento no encontrado o no tienes acceso.' };
    }

    const { data } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(document.storage_path, SIGNED_URL_EXPIRY);

    await supabase
      .from('documents')
      .update({ last_accessed: new Date().toISOString() })
      .eq('id', documentId);

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'DOCUMENT_DOWNLOADED',
      resource_type: 'document',
      resource_id: documentId,
    });

    return { url: data?.signedUrl || null };
  } catch (error) {
    console.error('Get download URL error:', error);
    return {
      url: null,
      error: 'Error al obtener URL de descarga.',
    };
  }
}

/**
 * Elimina un documento (archivo y registro BD)
 */
export async function deleteDocument(userId: string, documentId: string): Promise<boolean> {
  if (storageType === 'local' || !isProduction) {
    try {
      const res = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  const supabase = getSupabaseClient();

  try {
    // 1. Obtener información del documento
    const { data: document } = await supabase
      .from('documents')
      .select('storage_path, file_size_bytes, user_id')
      .eq('id', documentId)
      .single();

    if (!document || document.user_id !== userId) {
      return false;
    }

    // 2. Eliminar archivo de storage
    await supabase.storage.from(STORAGE_BUCKET).remove([document.storage_path]);

    // 3. Eliminar documento de BD
    await supabase.from('documents').delete().eq('id', documentId);

    // 4. Liberar espacio en perfil
    await supabase.rpc('free_storage', {
      p_user_id: userId,
      p_file_size_bytes: document.file_size_bytes,
    });

    // 5. Registrar en audit log
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'DOCUMENT_DELETED',
      resource_type: 'document',
      resource_id: documentId,
    });

    return true;
  } catch (error) {
    console.error('Delete document error:', error);
    return false;
  }
}

/**
 * Obtiene lista de documentos del usuario
 */
export async function getUserDocuments(
  userId: string,
  filters?: {
    categoryId?: string;
    archived?: boolean;
    starred?: boolean;
  }
): Promise<Document[]> {
  if (storageType === 'local' || !isProduction) {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        let docs = data.documents;
        if (filters?.categoryId) docs = docs.filter((d: any) => d.category_id === filters.categoryId);
        if (filters?.archived !== undefined) docs = docs.filter((d: any) => d.is_archived === filters.archived);
        if (filters?.starred) docs = docs.filter((d: any) => d.is_starred === true);
        return docs as Document[];
      }
    } catch (e) {
      console.error('Error fetching documents locally', e);
    }
    return [];
  }

  const supabase = getSupabaseClient();

  let query = supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }

  if (filters?.archived !== undefined) {
    query = query.eq('is_archived', filters.archived);
  }

  if (filters?.starred) {
    query = query.eq('is_starred', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Get documents error:', error);
    return [];
  }

  return data as Document[];
}

/**
 * Actualiza metadatos de un documento
 */
export async function updateDocument(
  userId: string,
  documentId: string,
  updates: Partial<Document>
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    // Verificar que el documento pertenece al usuario
    const { data: document } = await supabase
      .from('documents')
      .select('user_id')
      .eq('id', documentId)
      .single();

    if (!document || document.user_id !== userId) {
      return false;
    }

    // Actualizar solo campos permitidos
    const allowedUpdates = {
      description: updates.description,
      tags: updates.tags,
      category_id: updates.category_id,
      is_starred: updates.is_starred,
      is_archived: updates.is_archived,
      access_level: updates.access_level,
    };

    const { error } = await supabase
      .from('documents')
      .update(allowedUpdates)
      .eq('id', documentId);

    if (error) {
      console.error('Update document error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Update document error:', error);
    return false;
  }
}
