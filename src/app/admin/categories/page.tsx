"use client";

import { useEffect, useState } from 'react';
import { Pencil, Check, X, Plus, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

interface CategoryTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color_code: string;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_FORM = { name: '', description: '', icon: 'folder', color_code: '#475569', sort_order: '99' };

export default function AdminCategoriesPage() {
  const [cats, setCats]         = useState<CategoryTemplate[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<CategoryTemplate>>({});
  const [saving, setSaving]     = useState(false);
  const [showNew, setShowNew]   = useState(false);
  const [newForm, setNewForm]   = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError]       = useState('');

  const fetchCats = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/categories');
    if (res.ok) setCats((await res.json()).categories ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCats(); }, []);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/admin/categories/${editing}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });
    if (res.ok) { setEditing(null); await fetchCats(); }
    setSaving(false);
  };

  const toggleActive = async (cat: CategoryTemplate) => {
    await fetch(`/api/admin/categories/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !cat.is_active }),
    });
    await fetchCats();
  };

  const deletecat = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría del template? No afecta a usuarios existentes.')) return;
    setDeleting(id);
    await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    await fetchCats();
    setDeleting(null);
  };

  const createCat = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        newForm.name,
        description: newForm.description || null,
        icon:        newForm.icon,
        color_code:  newForm.color_code,
        sort_order:  Number(newForm.sort_order),
      }),
    });
    if (res.ok) { setShowNew(false); setNewForm(EMPTY_FORM); await fetchCats(); }
    else { const d = await res.json(); setError(d.error ?? 'Error al crear.'); }
    setCreating(false);
  };

  const inputCls = "bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:border-purple-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Categorías Template</h1>
          <p className="text-slate-400 text-sm mt-1">Categorías que se crean automáticamente para nuevos usuarios</p>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Nueva Categoría
        </button>
      </div>

      <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-300 text-sm">
        Los cambios aquí solo afectan a nuevos usuarios. Las categorías de usuarios existentes no se modifican.
      </div>

      {showNew && (
        <form onSubmit={createCat} className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">Nueva Categoría Template</h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Nombre', key: 'name', placeholder: 'ej. Laboral' },
              { label: 'Descripción', key: 'description', placeholder: 'Descripción opcional' },
              { label: 'Ícono (Lucide)', key: 'icon', placeholder: 'ej. briefcase' },
              { label: 'Color (hex)', key: 'color_code', placeholder: '#475569', type: 'color' },
              { label: 'Orden', key: 'sort_order', placeholder: '99' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                {f.type === 'color'
                  ? <div className="flex gap-2 items-center">
                      <input type="color" value={(newForm as any)[f.key]}
                        onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-10 h-9 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                      <input className={inputCls} value={(newForm as any)[f.key]}
                        onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  : <input className={inputCls} placeholder={f.placeholder}
                      value={(newForm as any)[f.key]}
                      onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))} />
                }
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={creating}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Crear
            </button>
            <button type="button" onClick={() => { setShowNew(false); setError(''); }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-7 h-7 animate-spin text-purple-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase border-b border-white/5 bg-slate-900/40">
                  {['Color', 'Nombre', 'Ícono', 'Orden', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cats.map(cat => (
                  <tr key={cat.id} className={`hover:bg-white/[0.02] transition-colors ${!cat.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-4">
                      {editing === cat.id
                        ? <input type="color" value={editData.color_code ?? '#475569'}
                            onChange={e => setEditData(p => ({ ...p, color_code: e.target.value }))}
                            className="w-10 h-8 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                        : <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: cat.color_code }} />}
                    </td>
                    <td className="px-5 py-4">
                      {editing === cat.id
                        ? <input className={inputCls} value={editData.name ?? ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} />
                        : <span className="font-medium text-white">{cat.name}</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-mono text-xs">
                      {editing === cat.id
                        ? <input className={inputCls} value={editData.icon ?? ''} onChange={e => setEditData(p => ({ ...p, icon: e.target.value }))} />
                        : cat.icon}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {editing === cat.id
                        ? <input type="number" className={inputCls} value={editData.sort_order ?? ''} onChange={e => setEditData(p => ({ ...p, sort_order: Number(e.target.value) }))} />
                        : cat.sort_order}
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => toggleActive(cat)}>
                        {cat.is_active
                          ? <ToggleRight className="w-6 h-6 text-green-400" />
                          : <ToggleLeft className="w-6 h-6 text-slate-500" />}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      {editing === cat.id ? (
                        <div className="flex gap-2">
                          <button onClick={saveEdit} disabled={saving} className="p-1.5 rounded-lg text-green-400 hover:bg-green-400/10">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => { setEditing(cat.id); setEditData({ ...cat }); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deletecat(cat.id)} disabled={deleting === cat.id} className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10">
                            {deleting === cat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
