"use client";

import { useEffect, useState } from 'react';
import { Plus, HardDrive, FileText, Clock, AlertCircle, AlertTriangle, ShieldAlert, Trash2, Search } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { deleteDocument } from '@/services/documentService';

export default function DashboardPage() {
  const [data, setData] = useState<any>({ documents: [], categories: [], quota: null });
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const bytesToMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

  const handleDelete = async (docId: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este archivo de forma permanente?')) {
      const success = await deleteDocument('current-user', docId); // server usa cookie internamente
      if (success) {
        fetchDashboardData();
      } else {
        alert('Hubo un error eliminando el archivo.');
      }
    }
  };

  if (loading) {
    return <div className="animate-pulse text-slate-400 font-medium">Cargando tu información...</div>;
  }

  const { documents = [], quota = null, categories = [] } = data;

  const now = new Date();
  const alertThreshold = new Date();
  alertThreshold.setDate(now.getDate() + 30); 

  let documentsWithAlerts = 0;
  
  const filteredDocuments = documents.filter((doc: any) => {
    if (doc.expiry_date) {
      const expiry = new Date(doc.expiry_date);
      if (expiry <= alertThreshold) documentsWithAlerts++;
    }
    
    // Filtro de Búsqueda de Texto
    if (searchQuery && !doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    if (activeCategoryId) return doc.category_id === activeCategoryId;
    return true;
  });

  const getExpiryBadge = (dateString: string) => {
    if (!dateString) return null;
    const expiry = new Date(dateString);
    if (expiry < now) {
      return <span className="flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30"><AlertTriangle className="w-3 h-3 mr-1" /> Vencido</span>;
    }
    if (expiry <= alertThreshold) {
      return <span className="flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30"><Clock className="w-3 h-3 mr-1" /> Por vencer</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">Vence: {expiry.toLocaleDateString()}</span>;
  };

  return (
    <div className="space-y-8 pb-12">
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

      {/* Barra de Búsqueda y Subida */}
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            type="text"
            placeholder="Buscar documentos por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-soft"
          />
        </div>

        {isUploading && (
          <div className="bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 border border-white/5 animate-fade-in shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center">
                 <AlertCircle className="w-5 h-5 mr-2 text-blue-400" />
                 Asegura tus documentos.
              </h2>
              <button onClick={() => setIsUploading(false)} className="text-slate-400 hover:text-white transition-colors">Cerrar</button>
            </div>
            <FileUpload 
              userId={'current-user'} 
              categories={categories}
              onSuccess={(doc) => {
                fetchDashboardData();
                if (doc.category_id) {
                  setActiveCategoryId(doc.category_id);
                }
                setTimeout(() => setIsUploading(false), 2000);
              }} 
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-300">Almacenamiento</h3>
            <HardDrive className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white mb-2">{quota ? bytesToMB(quota.used_bytes) : 0} <span className="text-lg text-slate-500">MB</span></p>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${quota?.percentage_used || 0}%` }}></div>
          </div>
          <p className="text-xs text-slate-500 mt-2">De {quota ? bytesToMB(quota.total_bytes) : 0} MB permitidos.</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-300">Total Archivos</h3>
            <FileText className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-white mb-2">{documents?.length || 0}</p>
        </div>

        <div className={`backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-soft transition-colors ${documentsWithAlerts > 0 ? 'bg-red-900/20 border-red-500/20' : 'bg-slate-900/50'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-300">Alertas Activas</h3>
            <ShieldAlert className={`w-5 h-5 ${documentsWithAlerts > 0 ? 'text-red-400' : 'text-slate-500'}`} />
          </div>
          <p className={`text-3xl font-bold mb-2 ${documentsWithAlerts > 0 ? 'text-red-400' : 'text-white'}`}>{documentsWithAlerts}</p>
          <p className="text-xs text-slate-500 mt-2">Docs. vencidos o a &lt; 30 días.</p>
        </div>
      </div>

      {categories && categories.length > 0 && (
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
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

      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-soft">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">
            {searchQuery ? 'Resultados de Búsqueda' : (activeCategoryId ? 'Resultados Filtrados' : 'Archivos Recientes')}
          </h2>
        </div>
        
        {filteredDocuments && filteredDocuments.length > 0 ? (
          <div className="divide-y divide-white/5">
            {filteredDocuments.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors group">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-colors">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-3">
                      <h4 className="text-white font-medium group-hover:text-blue-300 transition-colors cursor-pointer">{doc.file_name}</h4>
                      {getExpiryBadge(doc.expiry_date)}
                    </div>
                    <div className="flex items-center text-sm text-slate-500 mt-1 space-x-3">
                      <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {new Date(doc.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{bytesToMB(doc.file_size_bytes)} MB</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <a href={doc.storage_path} target="_blank" rel="noreferrer" className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                    Abrir
                  </a>
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
