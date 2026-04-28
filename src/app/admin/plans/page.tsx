"use client";

import { useEffect, useState } from 'react';
import { Pencil, Check, X, Plus, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Plan {
  id: string;
  code: string;
  name: string;
  storage_bytes: number;
  max_documents: number | null;
  max_file_size_mb: number;
  allow_media_files: boolean;
  price_monthly_cop: number;
  price_semiannual_cop: number;
  price_annual_cop: number;
  is_active: boolean;
}

function fmtBytes(b: number) {
  if (b >= 1e9) return (b / 1e9).toFixed(0) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(0) + ' MB';
  return (b / 1e3).toFixed(0) + ' KB';
}

function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

const EMPTY_FORM = {
  code: '', name: '', storage_bytes: '', max_documents: '', max_file_size_mb: '',
  price_monthly_cop: '0', price_semiannual_cop: '0', price_annual_cop: '0',
};

export default function AdminPlansPage() {
  const [plans, setPlans]           = useState<Plan[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState<string | null>(null);
  const [editName, setEditName]     = useState('');
  const [editStrings, setEditStrings] = useState<Record<string, string>>({});
  const [editAllowMedia, setEditAllowMedia] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [newForm, setNewForm]       = useState(EMPTY_FORM);
  const [creating, setCreating]     = useState(false);
  const [error, setError]           = useState('');

  const fetchPlans = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/plans');
    if (res.ok) setPlans((await res.json()).plans ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const startEdit = (plan: Plan) => {
    setEditing(plan.id);
    setEditName(plan.name);
    setEditAllowMedia(plan.allow_media_files);
    setEditStrings({
      storage_bytes:        String(plan.storage_bytes),
      max_documents:        plan.max_documents !== null ? String(plan.max_documents) : '',
      max_file_size_mb:     String(plan.max_file_size_mb),
      price_monthly_cop:    String(plan.price_monthly_cop),
      price_semiannual_cop: String(plan.price_semiannual_cop),
      price_annual_cop:     String(plan.price_annual_cop),
    });
  };

  const numStr = (key: string) => editStrings[key] ?? '';
  const setNum = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditStrings(p => ({ ...p, [key]: e.target.value.replace(/[^0-9]/g, '') }));

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = {
      name:                 editName,
      storage_bytes:        Number(editStrings.storage_bytes)        || 0,
      max_documents:        editStrings.max_documents !== '' ? Number(editStrings.max_documents) : null,
      max_file_size_mb:     Number(editStrings.max_file_size_mb)     || 0,
      allow_media_files:    editAllowMedia,
      price_monthly_cop:    Number(editStrings.price_monthly_cop)    || 0,
      price_semiannual_cop: Number(editStrings.price_semiannual_cop) || 0,
      price_annual_cop:     Number(editStrings.price_annual_cop)     || 0,
    };
    const res = await fetch(`/api/admin/plans/${editing}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { setEditing(null); await fetchPlans(); }
    setSaving(false);
  };

  const toggleActive = async (plan: Plan) => {
    await fetch(`/api/admin/plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !plan.is_active }),
    });
    await fetchPlans();
  };

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    const res = await fetch('/api/admin/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code:                 newForm.code,
        name:                 newForm.name,
        storage_bytes:        Number(newForm.storage_bytes),
        max_documents:        newForm.max_documents ? Number(newForm.max_documents) : null,
        max_file_size_mb:     Number(newForm.max_file_size_mb),
        price_monthly_cop:    Number(newForm.price_monthly_cop),
        price_semiannual_cop: Number(newForm.price_semiannual_cop),
        price_annual_cop:     Number(newForm.price_annual_cop),
      }),
    });
    if (res.ok) { setShowNew(false); setNewForm(EMPTY_FORM); await fetchPlans(); }
    else { const d = await res.json(); setError(d.error ?? 'Error al crear plan.'); }
    setCreating(false);
  };

  const inputCls = "bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:border-purple-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planes</h1>
          <p className="text-slate-400 text-sm mt-1">Catálogo de planes de suscripción</p>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Nuevo Plan
        </button>
      </div>

      {/* Formulario nuevo plan */}
      {showNew && (
        <form onSubmit={createPlan} className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">Nuevo Plan</h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Código', key: 'code', placeholder: 'ej. starter' },
              { label: 'Nombre', key: 'name', placeholder: 'ej. Starter' },
              { label: 'Almacenamiento (bytes)', key: 'storage_bytes', placeholder: '524288000' },
              { label: 'Máx. documentos', key: 'max_documents', placeholder: 'vacío = ilimitado' },
              { label: 'Máx. archivo (MB)', key: 'max_file_size_mb', placeholder: '10' },
              { label: 'Precio mensual COP', key: 'price_monthly_cop', placeholder: '9900' },
              { label: 'Precio semestral COP', key: 'price_semiannual_cop', placeholder: '8415' },
              { label: 'Precio anual COP', key: 'price_annual_cop', placeholder: '7425' },
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

      {/* Tabla */}
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-7 h-7 animate-spin text-purple-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase border-b border-white/5 bg-slate-900/40">
                  {['Código', 'Nombre', 'Almacenamiento', 'Docs', 'Arch. máx', 'Media', 'P. Mensual', 'P. Semestral /mes', 'P. Anual /mes', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {plans.map(plan => (
                  <tr key={plan.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 font-mono text-slate-300">{plan.code}</td>
                    <td className="px-5 py-4">
                      {editing === plan.id
                        ? <input className={inputCls} value={editName} onChange={e => setEditName(e.target.value)} />
                        : <span className="font-medium text-white">{plan.name}</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {editing === plan.id
                        ? <input type="text" inputMode="numeric" className={inputCls} placeholder="bytes" value={numStr('storage_bytes')} onChange={setNum('storage_bytes')} />
                        : fmtBytes(plan.storage_bytes)}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {editing === plan.id
                        ? <input type="text" inputMode="numeric" className={inputCls} placeholder="∞ vacío" value={numStr('max_documents')} onChange={setNum('max_documents')} />
                        : plan.max_documents ?? '∞'}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {editing === plan.id
                        ? <input type="text" inputMode="numeric" className={inputCls} placeholder="MB" value={numStr('max_file_size_mb')} onChange={setNum('max_file_size_mb')} />
                        : `${plan.max_file_size_mb} MB`}
                    </td>
                    <td className="px-5 py-4">
                      {editing === plan.id
                        ? <button onClick={() => setEditAllowMedia((v: boolean) => !v)} className="transition-colors">
                            {editAllowMedia
                              ? <ToggleRight className="w-6 h-6 text-green-400" />
                              : <ToggleLeft className="w-6 h-6 text-slate-500" />}
                          </button>
                        : plan.allow_media_files
                          ? <span className="text-xs font-medium text-green-400">Sí</span>
                          : <span className="text-xs text-slate-500">No</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {editing === plan.id
                        ? <input type="text" inputMode="numeric" className={inputCls} placeholder="COP" value={numStr('price_monthly_cop')} onChange={setNum('price_monthly_cop')} />
                        : fmtCOP(plan.price_monthly_cop)}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {editing === plan.id
                        ? <input type="text" inputMode="numeric" className={inputCls} placeholder="COP" value={numStr('price_semiannual_cop')} onChange={setNum('price_semiannual_cop')} />
                        : <span className={plan.price_semiannual_cop === 0 ? 'text-red-400 font-semibold' : ''}>{fmtCOP(plan.price_semiannual_cop)}</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {editing === plan.id
                        ? <input type="text" inputMode="numeric" className={inputCls} placeholder="COP" value={numStr('price_annual_cop')} onChange={setNum('price_annual_cop')} />
                        : <span className={plan.price_annual_cop === 0 ? 'text-red-400 font-semibold' : ''}>{fmtCOP(plan.price_annual_cop)}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => toggleActive(plan)} className="transition-colors">
                        {plan.is_active
                          ? <ToggleRight className="w-6 h-6 text-green-400" />
                          : <ToggleLeft className="w-6 h-6 text-slate-500" />}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      {editing === plan.id ? (
                        <div className="flex gap-2">
                          <button onClick={saveEdit} disabled={saving} className="p-1.5 rounded-lg text-green-400 hover:bg-green-400/10 transition-colors">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(plan)} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 transition-colors">
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
