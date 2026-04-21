// @ts-nocheck
import {
  DocumentUploadPayload,
  StorageQuotaInfo,
  UploadResult,
  PlanType,
} from '@/types';
import { processFile } from '@/utils/fileValidation';

export async function getStorageQuota(_userId: string): Promise<StorageQuotaInfo> {
  try {
    const res = await fetch('/api/documents');
    if (res.ok) {
      const data = await res.json();
      if (data.quota) return data.quota;
    }
  } catch (e) {
    console.error('Error fetching quota:', e);
  }
  return {
    total_bytes: 20971520,
    used_bytes: 0,
    available_bytes: 20971520,
    percentage_used: 0,
    plan_type: PlanType.FREE,
  };
}

export async function uploadDocument(
  _userId: string,
  payload: DocumentUploadPayload
): Promise<UploadResult> {
  try {
    const processedFile = await processFile(payload.file);

    const formData = new FormData();
    formData.append('file', processedFile);
    if (payload.category_id) formData.append('categoryId', payload.category_id);
    if (payload.expiry_date) formData.append('expiryDate', payload.expiry_date.toISOString().split('T')[0]);
    if (payload.expiry_note) formData.append('expiryNote', payload.expiry_note);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || 'Error al subir el archivo' };
    }
    return { success: true, document: data.document, signedUrl: data.signedUrl };
  } catch (error) {
    console.error('Upload document error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al subir el documento.',
    };
  }
}

export async function deleteDocument(_userId: string, documentId: string): Promise<boolean> {
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
