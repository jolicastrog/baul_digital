'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { processFile, formatBytes, validateFile } from '@/utils/fileValidation';
import { uploadDocument, getStorageQuota } from '@/services/documentService';
import { Document, DocumentUploadPayload, StorageQuotaInfo } from '@/types';

export interface FileUploadProps {
  userId: string;
  categoryId?: string;
  categories?: any[];
  onSuccess?: (document: Document) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  file: File | null;
  error: string | null;
  success: boolean;
  storageQuota: StorageQuotaInfo | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  userId,
  categoryId,
  categories = [],
  onSuccess,
  onError,
  className,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(categoryId || '');
  const [expiryDate, setExpiryDate] = useState('');
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    file: null,
    error: null,
    success: false,
    storageQuota: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Obtener cuota de almacenamiento
  const loadStorageQuota = useCallback(async () => {
    try {
      const quota = await getStorageQuota(userId);
      setState((prev) => ({ ...prev, storageQuota: quota }));
    } catch (error) {
      console.error('Error loading storage quota:', error);
    }
  }, [userId]);

  React.useEffect(() => {
    loadStorageQuota();
  }, [loadStorageQuota]);

  // Ejecutar carga al servidor (Construido primero para la dependencia)
  const performUpload = useCallback(
    async (file: File) => {
      setState((prev) => ({ ...prev, isUploading: true, progress: 0 }));

      try {
        const progressInterval = setInterval(() => {
          setState((prev) => {
            const newProgress = Math.min(prev.progress + Math.random() * 30, 90);
            return { ...prev, progress: newProgress };
          });
        }, 300);

        const payload: DocumentUploadPayload = {
          file,
          category_id: selectedCategory || undefined,
          expiry_date: expiryDate ? new Date(expiryDate) : undefined,
          access_level: 'private',
        };

        const result = await uploadDocument(userId, payload);

        clearInterval(progressInterval);

        if (result.success && result.document) {
          setState((prev) => ({
            ...prev,
            progress: 100,
            success: true,
            isUploading: false,
            file: null,
          }));
          onSuccess?.(result.document);

          setTimeout(() => {
            setState((prev) => ({ ...prev, success: false }));
          }, 3000);

          await loadStorageQuota();
        } else {
          const errorMsg = result.error || 'Error desconocido al subir el archivo';
          setState((prev) => ({
            ...prev,
            isUploading: false,
            error: errorMsg,
            progress: 0,
          }));
          onError?.(errorMsg);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error al subir el archivo';
        setState((prev) => ({
          ...prev,
          isUploading: false,
          error: errorMsg,
          progress: 0,
        }));
        onError?.(errorMsg);
      }
    },
    [userId, selectedCategory, expiryDate, onSuccess, onError, loadStorageQuota]
  );

  // Procesar archivo seleccionado (Depende de performUpload)
  const handleFileSelect = useCallback(
    async (file: File) => {
      setState((prev) => ({ ...prev, error: null, success: false }));

      const validation = validateFile(file);
      if (!validation.valid) {
        const errorMsg = validation.error || 'Archivo inválido';
        setState((prev) => ({ ...prev, error: errorMsg }));
        onError?.(errorMsg);
        return;
      }

      setState((prev) => ({ ...prev, file }));

      try {
        const processedFile = await processFile(file);
        setState((prev) => ({ ...prev, file: processedFile }));

        await performUpload(processedFile);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error al procesar el archivo';
        setState((prev) => ({ ...prev, error: errorMsg }));
        onError?.(errorMsg);
      }
    },
    [onError, performUpload]
  );

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const storagePercentage = state.storageQuota
    ? (state.storageQuota.used_bytes / state.storageQuota.total_bytes) * 100
    : 0;

  return (
    <div className={cn('w-full space-y-4', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Categoría (Opcional)</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={state.isUploading}
            className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Seleccione o "Ninguna"</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Fecha de Caducidad (Opcional)</label>
          <input 
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={state.isUploading}
            className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Área de carga */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative rounded-2xl border-2 border-dashed p-8 transition-all cursor-pointer',
          'hover:border-primary-blue hover:bg-blue-50',
          dragCounter.current > 0 && 'border-primary-blue bg-blue-50',
          state.isUploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleInputChange}
          className="hidden"
          disabled={state.isUploading}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <Upload className="h-12 w-12 text-primary-blue" />
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-900">
              {state.isUploading ? 'Cargando...' : 'Arrastra archivos aquí'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {state.isUploading ? (
                `Progreso: ${Math.round(state.progress)}%`
              ) : (
                <>
                  O{' '}
                  <span className="font-semibold text-primary-blue cursor-pointer hover:underline">
                    haz clic para seleccionar
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Barra de progreso */}
        {state.isUploading && (
          <div className="mt-4 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-blue transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Información del archivo seleccionado */}
      {state.file && (
        <div className="rounded-lg bg-slate-50 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Upload className="h-5 w-5 text-primary-blue" />
            <div>
              <p className="font-medium text-slate-900">{state.file.name}</p>
              <p className="text-sm text-slate-500">{formatBytes(state.file.size)}</p>
            </div>
          </div>
          {!state.isUploading && (
            <button
              onClick={() =>
                setState((prev) => ({ ...prev, file: null, error: null, success: false }))
              }
              className="p-1 hover:bg-red-100 text-red-600 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* Mensaje de error */}
      {state.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{state.error}</p>
          </div>
        </div>
      )}

      {/* Mensaje de éxito */}
      {state.success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-start space-x-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-900">¡Archivo cargado con éxito!</p>
          </div>
        </div>
      )}

      {/* Información de almacenamiento */}
      {state.storageQuota && (
        <div className="rounded-lg bg-slate-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-900">Almacenamiento utilizado</p>
            <p className="text-sm font-semibold text-slate-900">
              {Math.round(storagePercentage)}%
            </p>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-colors',
                storagePercentage > 90
                  ? 'bg-red-500'
                  : storagePercentage > 70
                    ? 'bg-yellow-500'
                    : 'bg-emerald-accent'
              )}
              style={{ width: `${storagePercentage}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {formatBytes(state.storageQuota.used_bytes)} de{' '}
            {formatBytes(state.storageQuota.total_bytes)} (
            {formatBytes(state.storageQuota.available_bytes)} disponible)
          </p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
