"use client";

import { useEffect, useState, useCallback } from 'react';
import {
  Bell, Plus, Pencil, Trash2, Loader2, CheckCircle2,
  AlertCircle, ToggleLeft, ToggleRight, X, Save,
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Rule {
  id:          string;
  days_before: number;
  label:       string;
  is_active:   boolean;
  sort_order:  number;
}

type ActionMsg = { type: 'success' | 'error'; text: string } | null;

// ── Componente principal ───────────────────────────────────────────────────────
export default function ExpiryRemindersPage() {
  const [enabled, setEnabled]    = useState(true);
  const [rules, setRules]        = useState<Rule[]>([]);
  const [loading, setLoading]    = useState(true);
  const [toggling, setToggling]  = useState(false);
  const [actionMsg, setActionMsg] = useState<ActionMsg>(null);

  // Estado del modal crear/editar
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [formDays, setFormDays]   = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formOrder, setFormOrder] = useState('0');
  const [saving, setSaving]       = useState(false);

  // Estado de eliminación
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // ── Carga ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/expiry-reminders');
    if (res.ok) {
      const data = await res.json();
      setEnabled(data.reminders_enabled ?? true);
      setRules(data.rules ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type: 'success' | 'error', text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 4000);
  };

  // ── Toggle global ─────────────────────────────────────────────────────────────
  const handleToggleGlobal = async () => {
    setToggling(true);
    const res = await fetch('/api/admin/expiry-reminders', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ reminders_enabled: !enabled }),
    });
    if (res.ok) {
      setEnabled(prev => !prev);
      flash('success', `Sistema de recordatorios ${!enabled ? 'activado' : 'desactivado'}.`);
    } else {
      flash('error', 'Error al cambiar el estado del sistema.');
    }
    setToggling(false);
  };

  // ── Toggle de regla individual ────────────────────────────────────────────────
  const handleToggleRule = async (rule: Rule) => {
    const res = await fetch(`/api/admin/expiry-reminders/rules/${rule.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_active: !rule.is_active }),
    });
    if (res.ok) {
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
      flash('success', `Regla "${rule.label}" ${!rule.is_active ? 'activada' : 'desactivada'}.`);
    } else {
      flash('error', 'Error al cambiar el estado de la regla.');
    }
  };

  // ── Abrir modal ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingRule(null);
    setFormDays('');
    setFormLabel('');
    setFormActive(true);
    setFormOrder(String(rules.length + 1));
    setModal('create');
  };

  const openEdit = (rule: Rule) => {
    setEditingRule(rule);
    setFormDays(String(rule.days_before));
    setFormLabel(rule.label);
    setFormActive(rule.is_active);
    setFormOrder(String(rule.sort_order));
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setEditingRule(null);
  };

  // ── Guardar (crear o editar) ──────────────────────────────────────────────────
  const handleSave = async () => {
    const days = parseInt(formDays, 10);
    if (!days || days <= 0) {
      flash('error', 'Los días deben ser un número mayor a 0.');
      return;
    }
    if (!formLabel.trim()) {
      flash('error', 'La etiqueta es requerida.');
      return;
    }

    setSaving(true);

    if (modal === 'create') {
      const res = await fetch('/api/admin/expiry-reminders/rules', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          days_before: days,
          label:       formLabel.trim(),
          is_active:   formActive,
          sort_order:  parseInt(formOrder, 10) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRules(prev => [...prev, data.rule].sort((a, b) => a.sort_order - b.sort_order || a.days_before - b.days_before));
        flash('success', `Regla "${formLabel}" creada.`);
        closeModal();
      } else {
        flash('error', data.error ?? 'Error al crear la regla.');
      }
    } else if (modal === 'edit' && editingRule) {
      const res = await fetch(`/api/admin/expiry-reminders/rules/${editingRule.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          label:      formLabel.trim(),
          is_active:  formActive,
          sort_order: parseInt(formOrder, 10) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRules(prev =>
          prev.map(r => r.id === editingRule.id ? data.rule : r)
              .sort((a, b) => a.sort_order - b.sort_order || a.days_before - b.days_before)
        );
        flash('success', 'Regla actualizada.');
        closeModal();
      } else {
        flash('error', data.error ?? 'Error al actualizar la regla.');
      }
    }

    setSaving(false);
  };

  // ── Eliminar regla ────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeleting(id);
    const res = await fetch(`/api/admin/expiry-reminders/rules/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setRules(prev => prev.filter(r => r.id !== id));
      flash('success', 'Regla eliminada.');
    } else {
      flash('error', data.error ?? 'Error al eliminar la regla.');
    }
    setDeleting(null);
    setConfirmDel(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Cabecera */}
      <div>
        <h1 className="text-2xl font-bold text-white">Recordatorios de Vencimiento</h1>
        <p className="text-slate-400 text-sm mt-1">
          Configura cuándo y cómo se envían emails de aviso de vencimiento de documentos.
        </p>
      </div>

      {/* Mensajes */}
      {actionMsg && (
        <div className={`flex items-start gap-3 rounded-xl p-4 text-sm ${
          actionMsg.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {actionMsg.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            : <AlertCircle  className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          {actionMsg.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
        </div>
      ) : (
        <>
          {/* ── Control global ──────────────────────────────────────────────────── */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Sistema de recordatorios</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Los usuarios Premium y Enterprise recibirán emails antes de que sus documentos venzan.
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleGlobal}
                disabled={toggling}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  enabled
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-slate-700/60 text-slate-400 border border-white/10 hover:bg-slate-700'
                }`}
              >
                {toggling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : enabled ? (
                  <ToggleRight className="w-4 h-4" />
                ) : (
                  <ToggleLeft className="w-4 h-4" />
                )}
                {enabled ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          </div>

          {/* ── Tabla de reglas ─────────────────────────────────────────────────── */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-white font-semibold text-sm">Reglas de envío</h2>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-xl text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar regla
              </button>
            </div>

            {rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                <Bell className="w-10 h-10 opacity-30" />
                <p className="text-sm">No hay reglas configuradas.</p>
                <button
                  onClick={openCreate}
                  className="text-xs text-purple-400 hover:text-purple-300 underline underline-offset-2"
                >
                  Agregar la primera regla
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs uppercase bg-slate-900/40 border-b border-white/5">
                      <th className="text-left px-6 py-3 font-medium">Días antes</th>
                      <th className="text-left px-6 py-3 font-medium">Etiqueta</th>
                      <th className="text-left px-6 py-3 font-medium">Orden</th>
                      <th className="text-left px-6 py-3 font-medium">Estado</th>
                      <th className="text-left px-6 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rules.map(rule => (
                      <tr key={rule.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-white font-mono font-bold text-base">
                            {rule.days_before}
                          </span>
                          <span className="text-slate-500 text-xs ml-1.5">días</span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">{rule.label}</td>
                        <td className="px-6 py-4 text-slate-500 tabular-nums">{rule.sort_order}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleRule(rule)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              rule.is_active
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-slate-700/60 text-slate-500 border border-white/10 hover:bg-slate-700'
                            }`}
                          >
                            {rule.is_active
                              ? <><ToggleRight className="w-3 h-3" /> Activa</>
                              : <><ToggleLeft  className="w-3 h-3" /> Inactiva</>}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(rule)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                              Editar
                            </button>
                            {confirmDel === rule.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleDelete(rule.id)}
                                  disabled={deleting === rule.id}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold transition-colors"
                                >
                                  {deleting === rule.id
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <Trash2  className="w-3 h-3" />}
                                  Confirmar
                                </button>
                                <button
                                  onClick={() => setConfirmDel(null)}
                                  className="px-2.5 py-1.5 bg-slate-700 text-slate-400 rounded-lg text-xs hover:text-white transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDel(rule.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700/10 hover:bg-red-700/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Nota informativa ────────────────────────────────────────────────── */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-5 py-4">
            <p className="text-blue-300 text-xs leading-relaxed">
              <strong>Cómo funciona:</strong> Al subir un documento con fecha de vencimiento, el sistema
              programa automáticamente un correo por cada regla activa que aplique. El cron se ejecuta
              diariamente a las 7:00 AM UTC. Al activar o crear una regla, se hace backfill automático
              de los documentos existentes elegibles (plan Premium/Enterprise con vencimiento futuro).
            </p>
          </div>
        </>
      )}

      {/* ── Modal crear / editar ───────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">
                {modal === 'create' ? 'Nueva regla' : 'Editar regla'}
              </h3>
              <button onClick={closeModal} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Días antes */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Días antes del vencimiento *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formDays}
                  onChange={e => setFormDays(e.target.value)}
                  disabled={modal === 'edit'}
                  placeholder="ej: 30"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 placeholder-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {modal === 'edit' && (
                  <p className="text-xs text-slate-600 mt-1">
                    Los días no se pueden editar (crearía duplicados). Elimina y crea una nueva regla.
                  </p>
                )}
              </div>

              {/* Etiqueta */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Etiqueta *</label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  placeholder="ej: 30 días antes"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 placeholder-slate-600"
                />
              </div>

              {/* Orden */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Orden en la lista</label>
                <input
                  type="number"
                  min="0"
                  value={formOrder}
                  onChange={e => setFormOrder(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Estado */}
              <div className="flex items-center justify-between bg-slate-800/60 border border-white/5 rounded-xl px-4 py-3">
                <span className="text-sm text-slate-300">Activar inmediatamente</span>
                <button
                  onClick={() => setFormActive(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    formActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-700 text-slate-400 border border-white/10'
                  }`}
                >
                  {formActive
                    ? <><ToggleRight className="w-3.5 h-3.5" /> Activa</>
                    : <><ToggleLeft  className="w-3.5 h-3.5" /> Inactiva</>}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {saving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save     className="w-4 h-4" />}
                {modal === 'create' ? 'Crear regla' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
