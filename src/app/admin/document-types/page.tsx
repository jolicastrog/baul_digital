"use client";

import { useEffect, useState } from 'react';
import { Pencil, Check, X, Plus, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

interface DocType {
  code: string;
  name: string;
  description: string | null;
  min_age_years: number | null;
  is_active: boolean;
  sort_order: number;
}

const EMPTY_FORM = { code: '', name: '', description: '', min_age_years: '', sort_order: '99' };

export default function AdminDocumentTypesPage() {
  const [types, setTypes]       = useState<DocType[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<DocType>>({});
  const [saving, setSaving]     = useState(false);
  const [showNew, setShowNew]   = useState(false);
  const [newForm, setNewForm]   = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState('');

  const fetchTypes = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/document-types');
    if (res.ok) setTypes((await res.json()).types ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTypes(); }, []);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/admin/document-types/${editing}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });
    if (res.ok) { setEditing(null); await fetchTypes(); }
    setSaving(false);
  };

  const toggleActive = async (dt: DocType) => {
    await fetch(`/api/admin/document-types/${dt.code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !dt.is_active }),
    });
    await fetchTypes();
  };

  const createType = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    const res = await fetch('/api/admin/document-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: newForm.code, name: newForm.name,
        description:   newForm.description   || null,
        min_age_years: newForm.min_age_years  ? Number(newForm.min_age_years) : null,
        sort_order:    Number(newForm.sort_order),
      }),
    });
    if (res.ok) { setShowNew(false); setNewForm(EMPTY_FORM); await fetchTypes(); }
    else { const d = await res.json(); setError(d.error ?? 'Error al crear.'); }
    setCreating(false);
  };

  const inputCls = "bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:border-purple-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tipos de Documento</h1>
          <p className="text-slate-400 text-sm mt-1">Habilita o deshabilita tipos para el registro</p>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Nuevo Tipo
        </button>
      </div>

      {showNew && (
        <form onSubmit={createType} className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">Nuevo Tipo de Documento</h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Código', key: 'code', placeholder: 'ej. PPT' },
              { label: 'Nombre', key: 'name', placeholder: 'ej. Pasaporte Temporal' },
              { label: 'Descripción', key: 'description', placeholder: 'Descripción opcional' },
              { label: 'Edad mínima', key: 'min_age_years', placeholder: 'vacío = sin límite' },
              { label: 'Orden', key: 'sort_order', placeholder: '99' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                <input className={inputCls} placeholder={f.placeholder}
                  value={(newForm as any)[f.key]}
                  onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))} />
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
                  {['Código', 'Nombre', 'Descripción', 'Edad mín.', 'Orden', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {types.map(dt => (
                  <tr key={dt.code} className={`hover:bg-white/[0.02] transition-colors ${!dt.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-4 font-mono font-semibold text-purple-300">{dt.code}</td>
                    <td className="px-5 py-4">
                      {editing === dt.code
                        ? <input className={inputCls} value={editData.name ?? ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} />
                        : <span className="font-medium text-white">{dt.name}</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-400 max-w-xs">
                      {editing === dt.code
                        ? <input className={inputCls} value={editData.description ?? ''} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} />
                        : <span className="truncate block">{dt.description ?? '—'}</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {editing === dt.code
                        ? <input type="number" className={inputCls} value={editData.min_age_years ?? ''} onChange={e => setEditData(p => ({ ...p, min_age_years: e.target.value ? Number(e.target.value) : null }))} />
                        : dt.min_age_years ? `${dt.min_age_years} años` : '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {editing === dt.code
                        ? <input type="number" className={inputCls} value={editData.sort_order ?? ''} onChange={e => setEditData(p => ({ ...p, sort_order: Number(e.target.value) }))} />
                        : dt.sort_order}
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => toggleActive(dt)} className="transition-colors">
                        {dt.is_active
                          ? <ToggleRight className="w-6 h-6 text-green-400" />
                          : <ToggleLeft className="w-6 h-6 text-slate-500" />}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      {editing === dt.code ? (
                        <div className="flex gap-2">
                          <button onClick={saveEdit} disabled={saving} className="p-1.5 rounded-lg text-green-400 hover:bg-green-400/10 transition-colors">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditing(dt.code); setEditData({ ...dt }); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
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
