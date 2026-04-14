import imageCompression, { Options } from 'browser-image-compression';

// ============================================================================
// CONSTANTES DE VALIDACIÓN
// ============================================================================

export const ALLOWED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export const MAX_FILE_SIZE_COMPRESSED = 300 * 1024; // 300KB después de compresión
export const MAX_IMAGE_DIMENSIONS = {
  width: 2048,
  height: 2048,
};

// ============================================================================
// VALIDACIÓN DE ARCHIVOS
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida el tipo de archivo contra la lista permitida
 */
export function validateFileType(file: File): ValidationResult {
  if (!file.type || !ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES]) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido. Tipos válidos: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}`,
    };
  }
  return { valid: true };
}

/**
 * Valida el tamaño del archivo
 */
export function validateFileSize(file: File, maxSize: number = MAX_FILE_SIZE): ValidationResult {
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `El archivo excede el tamaño máximo de ${formatBytes(maxSize)}. Tu archivo pesa ${formatBytes(file.size)}.`,
    };
  }
  return { valid: true };
}

/**
 * Valida que el archivo tenga nombre válido
 */
export function validateFileName(fileName: string): ValidationResult {
  const invalidChars = /[<>:"\/\\|?*]/g;
  if (invalidChars.test(fileName)) {
    return {
      valid: false,
      error: 'El nombre del archivo contiene caracteres inválidos.',
    };
  }
  if (fileName.length > 255) {
    return {
      valid: false,
      error: 'El nombre del archivo es demasiado largo (máximo 255 caracteres).',
    };
  }
  return { valid: true };
}

/**
 * Validación completa de archivo
 */
export function validateFile(file: File): ValidationResult {
  // 1. Validar nombre
  const nameValidation = validateFileName(file.name);
  if (!nameValidation.valid) return nameValidation;

  // 2. Validar tipo
  const typeValidation = validateFileType(file);
  if (!typeValidation.valid) return typeValidation;

  // 3. Validar tamaño
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.valid) return sizeValidation;

  return { valid: true };
}

// ============================================================================
// COMPRESIÓN DE ARCHIVOS
// ============================================================================

/**
 * Comprime una imagen reduciendo su tamaño y dimensiones
 */
export async function compressImage(
  file: File,
  options: Partial<Options> = {}
): Promise<File> {
  const defaultOptions: Options = {
    maxSizeMB: 0.3, // 300KB
    maxWidthOrHeight: MAX_IMAGE_DIMENSIONS.width,
    useWebWorker: true,
    quality: 0.8,
    ...options,
  };

  try {
    const compressedBlob = await imageCompression(file, defaultOptions);
    return new File([compressedBlob], file.name, {
      type: file.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('No fue posible comprimir la imagen. Por favor, intenta de nuevo.');
  }
}

/**
 * Determina si un archivo necesita compresión
 */
export function shouldCompress(file: File): boolean {
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  return imageTypes.includes(file.type) && file.size > MAX_FILE_SIZE_COMPRESSED;
}

/**
 * Procesa un archivo: validación y compresión si es necesario
 */
export async function processFile(file: File): Promise<File> {
  // Validar
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Comprimir si es necesario
  if (shouldCompress(file)) {
    return await compressImage(file);
  }

  return file;
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Formatea bytes a un formato legible
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Genera un nombre de archivo único con UUID
 */
export function generateStoragePath(userId: string, categoryName: string, fileName: string): string {
  const uuid = crypto.getRandomValues(new Uint8Array(16));
  const uuidString = Array.from(uuid)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const ext = fileName.split('.').pop() || '';
  return `${userId}/${categoryName}/${uuidString}.${ext}`;
}

/**
 * Extrae la extensión de archivo
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Obtiene el ícono para un tipo de archivo
 */
export function getFileIcon(fileType: string): string {
  const iconMap: Record<string, string> = {
    'application/pdf': 'FileText',
    'image/jpeg': 'Image',
    'image/png': 'Image',
    'image/webp': 'Image',
    'application/msword': 'FileText',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'FileText',
    'application/vnd.ms-excel': 'BarChart3',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'BarChart3',
  };

  return iconMap[fileType] || 'File';
}

/**
 * Hash simple para fingerprinting de navegador
 */
export async function generateBrowserFingerprint(): Promise<string> {
  const data = `${navigator.userAgent}${screen.width}${screen.height}${navigator.languages}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
