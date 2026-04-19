'use client';

import { useEffect, useState, useCallback } from 'react';
import { Lock, Pencil, Trash2, Plus, Check, X, Loader2, AlertCircle, Tag } from 'lucide-react';

type Category = {
  id:         string;
  name:       string;
  color_code: string;
  icon:       string;
  is_default: boolean;
  doc_count:  number;
};

const PRESET_COLORS = [
  '#1e40af', '#dc2626', '#7c3aed', '#059669',
  '#d97706', '#475569', '#db2777', '#0891b2',
  '#65a30d', '#ea580c',
];

export default function CategoryManager({ planType }: { planType: string }) {
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [maxCategories, setMaxCategories] = useState<number | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [msg,           setMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newName,  setNewName]  = useState('');
  const [newColor, setNewColor] = useState('#1e40af');
  const [creating, setCreating] = useState(false);

  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editingName,  setEditingName]  = useState('');
  const [editingColor, setEditingColor] = useState('');
  const [saving,       setSaving]       = useState(false);

  const [deletingId,        setDeletingId]        = useState<string | null>(null);
  const [moveDeleteId,      setMoveDeleteId]      = useState<string | null>(null);
  const [moveDeleteTarget,  setMoveDeleteTarget]  = useState('');
  const [movingAndDeleting, setMovingAndDeleting] = useState(false);

  const canManage = planType !== 'free';

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories);
        setMaxCategories(data.max_categories);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res  = await fetch('/api/categories', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: newName.trim(), color_code: newColor }),
    });
    const data = await res.json();
    if (res.ok) {
      showMsg('success', `Categoría "${newName.trim()}" creada.`);
      setNewName('');
      setNewColor('#1e40af');
      fetchCategories();
    } else {
      showMsg('error', data.error);
    }
    setCreating(false);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
    setEditingColor(cat.color_code);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    setSaving(true);
    const res  = await fetch(`/api/categories/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: editingName.trim(), color_code: editingColor }),
    });
    const data = await res.json();
    if (res.ok) {
      showMsg('success', 'Categoría actualizada.');
      setEditingId(null);
      fetchCategories();
    } else {
      showMsg('error', data.error);
    }
    setSaving(false);
  };

  const handleDelete = async (cat: Category) => {
    if (cat.doc_count > 0) {
      setMoveDeleteId(cat.id);
      setMoveDeleteTarget('');
      return;
    }
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
    setDeletingId(cat.id);
    const res  = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showMsg('success', `Categoría "${cat.name}" eliminada.`);
      fetchCategories();
    } else {
      showMsg('error', data.error);
    }
    setDeletingId(null);
  };

  const handleMoveAndDelete = async (cat: Category) => {
    setMovingAndDeleting(true);
    const moveRes = await fetch(`/api/categories/${cat.id}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ target_category_id: moveDeleteTarget || null }),
    });
    if (!moveRes.ok) {
      const d = await moveRes.json();
      showMsg('error', d.error ?? 'Error al mover los documentos.');
      setMovingAndDeleting(false);
      return;
    }
    const delRes  = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
    const delData = await delRes.json();
    if (delRes.ok) {
      showMsg('success', `Categoría "${cat.name}" eliminada y documentos movidos.`);
      setMoveDeleteId(null);
      fetchCategories();
    } else {
      showMsg('error', delData.error);
    }
    setMovingAndDeleting(false);
  };

  const totalCount = categories.length;
  const atLimit    = maxCategories !== null && totalCount >= maxCategories;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando categorías...
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Contador */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          <span className="text-white font-medium">{totalCount}</span>
          {maxCategories !== null
            ? ` de ${maxCategories} categorías usadas`
            : ' categorías (ilimitadas)'}
        </p>
        {atLimit && canManage && (
          <span className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-1 rounded-lg">
            Límite alcanzado
          </span>
        )}
      </div>

      {/* Mensaje feedback */}
      {msg && (
        <div className={`flex items-start gap-3 rounded-xl p-3 text-sm ${
          msg.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {msg.text}
        </div>
      )}

      {/* Lista de categorías */}
      <div className="space-y-2">
        {categories.map(cat => (
          <div key={cat.id} className="space-y-1">

            {/* Fila de categoría */}
            <div className="flex items-center gap-3 bg-slate-800/50 border border-white/5 rounded-xl px-4 py-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color_code }}
              />

              {editingId === cat.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveEdit(cat.id);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  maxLength={40}
                  className="flex-1 bg-slate-700 border border-blue-500/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                />
              ) : (
                <span className="flex-1 text-sm text-slate-200">{cat.name}</span>
              )}

              {cat.doc_count > 0 && (
                <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
                  {cat.doc_count} doc{cat.doc_count !== 1 ? 's' : ''}
                </span>
              )}

              {cat.is_default ? (
                <span title="Categoría por defecto">
                  <Lock className="w-4 h-4 text-slate-600 flex-shrink-0" />
                </span>
              ) : canManage ? (
                editingId === cat.id ? (
                  <div className="flex items-center gap-1">
                    <div className="flex gap-1 mr-1">
                      {PRESET_COLORS.slice(0, 5).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditingColor(c)}
                          className={`w-4 h-4 rounded-full transition-transform ${editingColor === c ? 'scale-125 ring-1 ring-white' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => handleSaveEdit(cat.id)}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(cat)}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                      title="Renombrar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={deletingId === cat.id}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                      title="Eliminar"
                    >
                      {deletingId === cat.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )
              ) : null}
            </div>

            {/* Panel mover y eliminar */}
            {moveDeleteId === cat.id && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 space-y-3">
                <p className="text-sm text-orange-300 font-medium">
                  Esta categoría tiene <strong>{cat.doc_count}</strong> documento{cat.doc_count !== 1 ? 's' : ''}.
                  {' '}¿A qué categoría deseas moverlos antes de eliminar?
                </p>
                <select
                  value={moveDeleteTarget}
                  onChange={e => setMoveDeleteTarget(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                >
                  <option value="">Sin categoría (desasociar)</option>
                  {categories
                    .filter(c => c.id !== cat.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMoveAndDelete(cat)}
                    disabled={movingAndDeleting}
                    className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {movingAndDeleting
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                    Mover y eliminar
                  </button>
                  <button
                    onClick={() => setMoveDeleteId(null)}
                    disabled={movingAndDeleting}
                    className="px-3 py-2 text-slate-400 hover:text-slate-200 text-sm rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

          </div>
        ))}
      </div>

      {/* Formulario nueva categoría */}
      {canManage ? (
        !atLimit ? (
          <form onSubmit={handleCreate} className="space-y-3 pt-2 border-t border-white/5">
            <p className="text-sm font-medium text-slate-300">Nueva categoría</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nombre de la categoría"
                maxLength={40}
                className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Crear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Color:</span>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Has alcanzado el límite de {maxCategories} categorías de tu plan.
          </div>
        )
      ) : (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/50 border border-white/5">
          <Tag className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-slate-300 font-medium">Categorías personalizadas</p>
            <p className="text-xs text-slate-500 mt-1">
              Disponible en planes Premium y Enterprise.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
