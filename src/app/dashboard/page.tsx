"use client";

import { useEffect, useState, useCallback } from 'react';
import { Plus, HardDrive, FileText, Clock, AlertCircle, AlertTriangle, ShieldAlert, Trash2, Search, Download, Pencil, Check, X, ChevronDown, Eye } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { deleteDocument } from '@/services/documentService';

export default function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<{ documents: any[]; categories: any[]; quota: any }>({ documents: [], categories: [], quota: null });
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // { [docId]: 'YYYY-MM-DD' | null } — null significa "sin fecha"
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [editingExpiry, setEditingExpiry] = useState<{ id: string; value: string } | null>(null);
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; mimeType: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Obtener ID del usuario autenticado
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(d => { if (d?.user?.id) setUserId(d.user.id); });
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const json = await res.json();
        setData({
          documents: json.documents ?? [],
          categories: json.categories ?? [],
          quota: json.quota ?? null,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const bytesToMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

  const handleDelete = async (docId: string) => {
    if (!userId) return;
    if (window.confirm('¿Seguro que deseas eliminar este archivo de forma permanente?')) {
      const success = await deleteDocument(userId, docId);
      if (success) {
        fetchDashboardData();
      } else {
        alert('Hubo un error eliminando el archivo.');
      }
    }
  };

  const handleSaveExpiry = async () => {
    if (!editingExpiry) return;
    setSavingExpiry(true);
    const res = await fetch('/api/documents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: editingExpiry.id,
        expiry_date: editingExpiry.value || null,
      }),
    });
    if (res.ok) {
      await fetchDashboardData();
    }
    setEditingExpiry(null);
    setSavingExpiry(false);
  };

  const getMimeType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
      mp4: 'video/mp4', mp3: 'audio/mpeg',
    };
    return map[ext] ?? 'application/octet-stream';
  };

  const handleOpen = async (docId: string, fileName: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/documents/url?id=${docId}`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        alert(data.error || 'No se pudo obtener el enlace del documento.');
        return;
      }
      const mimeType = getMimeType(fileName);
      const previewable = mimeType.startsWith('image/') || mimeType === 'application/pdf';
      if (previewable) {
        setPreview({ url: data.url, name: fileName, mimeType });
      } else {
        window.open(data.url, '_blank');
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse text-slate-400 font-medium">Cargando tu información...</div>;
  }

  const { documents, quota, categories } = data;

  const now = new Date();
  const in8Days  = new Date(); in8Days.setDate(now.getDate() + 8);
  const in30Days = new Date(); in30Days.setDate(now.getDate() + 30);

  // Clasificar documentos por nivel de alerta
  const expired:   any[] = [];
  const urgent:    any[] = []; // vencen en ≤ 8 días
  const upcoming:  any[] = []; // vencen en ≤ 30 días

  documents.forEach((doc: any) => {
    if (!doc.expiry_date) return;
    const expiry = new Date(doc.expiry_date);
    if (expiry < now)          expired.push(doc);
    else if (expiry <= in8Days)  urgent.push(doc);
    else if (expiry <= in30Days) upcoming.push(doc);
  });

  const documentsWithAlerts = expired.length + urgent.length + upcoming.length;

  const filteredDocuments = documents.filter((doc: any) => {
    if (searchQuery && !doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (activeCategoryId) return doc.category_id === activeCategoryId;
    return true;
  });

  const getExpiryBadge = (dateString: string) => {
    if (!dateString) return null;
    const expiry = new Date(dateString);
    if (expiry < now) {
      return <span className="flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30"><AlertTriangle className="w-3 h-3 mr-1" /> Vencido</span>;
    }
    if (expiry <= in8Days) {
      return <span className="flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30"><AlertTriangle className="w-3 h-3 mr-1" /> Vence pronto</span>;
    }
    if (expiry <= in30Days) {
      return <span className="flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Por vencer</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">Vence: {expiry.toLocaleDateString()}</span>;
  };

  return (
    <div className="space-y-8 pb-12">

      {/* ── Modal de previsualización ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
          {/* Barra superior */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <span className="text-white font-medium text-sm truncate">{preview.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <a
                href={preview.url}
                download={preview.name}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg text-xs font-medium transition-colors border border-blue-500/30"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Descargar</span>
              </a>
              <button
                onClick={() => setPreview(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-hidden flex items-center justify-center p-2 md:p-4">
            {preview.mimeType === 'application/pdf' ? (
              <iframe
                src={`${preview.url}#toolbar=1&navpanes=0`}
                className="w-full h-full rounded-lg border border-white/10"
                title={preview.name}
              />
            ) : preview.mimeType.startsWith('image/') ? (
              <img
                src={preview.url}
                alt={preview.name}
                className="max-w-full max-h-full object-contain rounded-lg select-none"
              />
            ) : null}
          </div>
        </div>
      )}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Tu Bóveda</h1>
          <p className="text-slate-400 mt-1">Sube, visualiza y gestiona tus archivos sensibles.</p>
        </div>
        <button
          onClick={() => setIsUploading(!isUploading)}
          className="flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5 mr-2" />
          Subir Documento
        </button>
      </header>

      {/* Panel de alertas de vencimiento */}
      {(expired.length > 0 || urgent.length > 0 || upcoming.length > 0) && (
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden">
          {/* Encabezado — clic para desplegar/replegar */}
          <button
            onClick={() => setAlertsExpanded(prev => !prev)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-white">Alertas de vencimiento</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                {expired.length + urgent.length + upcoming.length}
              </span>
              {!alertsExpanded && (
                <div className="flex items-center gap-2 ml-1">
                  {expired.length > 0 && <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{expired.length} vencido{expired.length > 1 ? 's' : ''}</span>}
                  {urgent.length > 0 && <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{urgent.length} urgente{urgent.length > 1 ? 's' : ''}</span>}
                  {upcoming.length > 0 && <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />{upcoming.length} próximo{upcoming.length > 1 ? 's' : ''}</span>}
                </div>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${alertsExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Lista con scroll — colapsable */}
          {alertsExpanded && (
            <>
              <div className="max-h-44 overflow-y-auto divide-y divide-white/5 border-t border-white/5">
                {expired.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="text-sm text-slate-200 truncate flex-1">{doc.file_name}</span>
                    <span className="text-xs text-red-400 font-medium flex-shrink-0">Vencido</span>
                  </div>
                ))}
                {urgent.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                    <span className="text-sm text-slate-200 truncate flex-1">{doc.file_name}</span>
                    <span className="text-xs text-orange-400 font-medium flex-shrink-0">
                      Vence {new Date(doc.expiry_date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {upcoming.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                    <span className="text-sm text-slate-200 truncate flex-1">{doc.file_name}</span>
                    <span className="text-xs text-yellow-400 font-medium flex-shrink-0">
                      Vence {new Date(doc.expiry_date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Leyenda */}
              <div className="flex items-center gap-4 px-5 py-2.5 border-t border-white/5 bg-slate-900/30">
                {expired.length > 0 && <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-red-500" />{expired.length} vencido{expired.length > 1 ? 's' : ''}</span>}
                {urgent.length > 0 && <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-orange-500" />{urgent.length} urgente{urgent.length > 1 ? 's' : ''}</span>}
                {upcoming.length > 0 && <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-yellow-500" />{upcoming.length} próximo{upcoming.length > 1 ? 's' : ''}</span>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Barra de Búsqueda y Subida */}
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar documentos por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
        </div>

        {isUploading && userId && (
          <div className="bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 border border-white/5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-blue-400" />
                Asegura tus documentos.
              </h2>
              <button onClick={() => setIsUploading(false)} className="text-slate-400 hover:text-white transition-colors">Cerrar</button>
            </div>
            <FileUpload
              userId={userId}
              categories={categories}
              onSuccess={(doc) => {
                fetchDashboardData();
                if (doc.category_id) setActiveCategoryId(doc.category_id);
                setTimeout(() => setIsUploading(false), 2000);
              }}
            />
          </div>
        )}
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-300">Almacenamiento</h3>
            <HardDrive className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white mb-2">
            {quota ? bytesToMB(quota.used_bytes) : 0} <span className="text-lg text-slate-500">MB</span>
          </p>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${quota?.percentage_used || 0}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">De {quota ? bytesToMB(quota.total_bytes) : 0} MB permitidos.</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-300">Documentos</h3>
            <FileText className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-white mb-2">
            {documents.length}
            {quota?.max_documents != null && (
              <span className="text-lg text-slate-500"> / {quota.max_documents}</span>
            )}
          </p>
          {quota?.max_documents != null && (
            <>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-colors ${
                    documents.length / quota.max_documents > 0.9
                      ? 'bg-red-500'
                      : documents.length / quota.max_documents > 0.7
                        ? 'bg-yellow-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (documents.length / quota.max_documents) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {quota.max_documents - documents.length} documento{quota.max_documents - documents.length !== 1 ? 's' : ''} disponible{quota.max_documents - documents.length !== 1 ? 's' : ''}.
              </p>
            </>
          )}
        </div>

        <div className={`backdrop-blur-xl border border-white/5 rounded-2xl p-6 transition-colors ${documentsWithAlerts > 0 ? 'bg-red-900/20 border-red-500/20' : 'bg-slate-900/50'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-300">Alertas Activas</h3>
            <ShieldAlert className={`w-5 h-5 ${documentsWithAlerts > 0 ? 'text-red-400' : 'text-slate-500'}`} />
          </div>
          <p className={`text-3xl font-bold mb-2 ${documentsWithAlerts > 0 ? 'text-red-400' : 'text-white'}`}>{documentsWithAlerts}</p>
          <p className="text-xs text-slate-500 mt-2">Docs. vencidos o a &lt; 30 días.</p>
        </div>
      </div>

      {/* Filtros por categoría */}
      {categories.length > 0 && (
        <div className="flex space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategoryId(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategoryId === null ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
          >
            Todos los Archivos
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategoryId === cat.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Lista de documentos */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">
            {searchQuery ? 'Resultados de Búsqueda' : activeCategoryId ? 'Resultados Filtrados' : 'Archivos Recientes'}
          </h2>
        </div>

        {filteredDocuments.length > 0 ? (
          <div className="divide-y divide-white/5">
            {filteredDocuments.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors group">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-colors">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-3">
                      <h4 className="text-white font-medium group-hover:text-blue-300 transition-colors">{doc.file_name}</h4>
                      {editingExpiry?.id !== doc.id && getExpiryBadge(doc.expiry_date)}
                    </div>
                    <div className="flex items-center text-sm text-slate-500 mt-1 space-x-3 flex-wrap gap-y-1">
                      <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" />{new Date(doc.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{bytesToMB(doc.file_size_bytes)} MB</span>
                      <span>•</span>
                      {editingExpiry?.id === doc.id ? (
                        <span className="flex items-center gap-1">
                          <input
                            type="date"
                            value={editingExpiry!.value}
                            onChange={e => setEditingExpiry({ id: doc.id, value: e.target.value })}
                            className="bg-slate-700 border border-white/10 rounded-lg px-2 py-0.5 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveExpiry}
                            disabled={savingExpiry}
                            className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Guardar"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingExpiry(null)}
                            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setEditingExpiry({
                            id: doc.id,
                            value: doc.expiry_date ? doc.expiry_date.split('T')[0] : '',
                          })}
                          className="flex items-center gap-1 text-slate-500 hover:text-blue-400 transition-colors"
                          title="Editar fecha de caducidad"
                        >
                          <Pencil className="w-3 h-3" />
                          <span className="text-xs">{doc.expiry_date ? 'Editar fecha' : 'Agregar fecha'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpen(doc.id, doc.file_name)}
                    disabled={previewLoading}
                    className="flex items-center px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4 mr-1.5" />
                    Ver
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500">
            <HardDrive className="w-16 h-16 mx-auto mb-4 opacity-50 text-slate-600" />
            <p className="text-lg font-medium text-slate-300 mb-1">Aún no hay archivos</p>
            <p>Sube tu primer documento o ajusta los filtros.</p>
          </div>
        )}
      </div>
    </div>
  );
}
