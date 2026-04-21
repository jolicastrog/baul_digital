"use client";

import { useEffect, useState, useCallback } from 'react';
import {
  Trash2, Clock, Search, ChevronLeft, ChevronRight,
  Loader2, CheckCircle2, AlertCircle, XCircle, UserX,
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface PendingRow {
  request_id:    string;
  user_id:       string | null;
  user_email:    string;
  requested_at:  string;
  scheduled_for: string;
  days_remaining: number;
  reason:        string | null;
  request_ip:    string | null;
}

interface DeletedRow {
  id:               string;
  original_user_id: string;
  email:            string;
  full_name:        string | null;
  plan_type:        string | null;
  doc_count:        number | null;
  deletion_reason:  string | null;
  requested_at:     string | null;
  executed_at:      string;
  retain_until:     string;
  total_count:      number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const PLAN_BADGE: Record<string, string> = {
  free:       'bg-slate-700 text-slate-300',
  premium:    'bg-purple-700/60 text-purple-200',
  enterprise: 'bg-amber-700/60 text-amber-200',
};

const LIMIT = 20;

// ── Página ─────────────────────────────────────────────────────────────────
export default function DeletionsPage() {
  const [tab, setTab]             = useState<'pending' | 'deleted'>('pending');
  const [pendingRows, setPending] = useState<PendingRow[]>([]);
  const [deletedRows, setDeleted] = useState<DeletedRow[]>([]);
  const [totalDeleted, setTotal]  = useState(0);
  const [offset, setOffset]       = useState(0);
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Para cancelar solicitudes pendientes
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Carga ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setActionMsg(null);

    const params = new URLSearchParams({ tab });
    if (tab === 'deleted') {
      params.set('limit',  String(LIMIT));
      params.set('offset', String(offset));
      if (search) params.set('search', search);
    }

    const res = await fetch(`/api/admin/deletions?${params}`);
    if (!res.ok) { setError('Error al cargar los datos.'); setLoading(false); return; }
    const data = await res.json();

    if (tab === 'pending') {
      setPending(data.rows ?? []);
    } else {
      setDeleted(data.rows ?? []);
      setTotal(data.rows?.[0]?.total_count ?? 0);
    }
    setLoading(false);
  }, [tab, offset, search]);

  useEffect(() => { load(); }, [load]);

  // Reset offset cuando cambia tab o búsqueda
  useEffect(() => { setOffset(0); }, [tab, search]);

  // ── Cancelar solicitud ───────────────────────────────────────────────────
  const handleCancel = async (requestId: string) => {
    setCancelling(requestId);
    setActionMsg(null);
    const res = await fetch('/api/admin/deletions', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ request_id: requestId, admin_note: cancelNote[requestId] ?? null }),
    });
    const data = await res.json();
    if (res.ok) {
      setActionMsg({ type: 'success', text: 'Solicitud cancelada correctamente.' });
      setPending(prev => prev.filter(r => r.request_id !== requestId));
    } else {
      setActionMsg({ type: 'error', text: data.error ?? 'Error al cancelar.' });
    }
    setCancelling(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(totalDeleted / LIMIT);
  const page       = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">

      {/* Cabecera */}
      <div>
        <h1 className="text-2xl font-bold text-white">Bajas de Cuenta</h1>
        <p className="text-slate-400 text-sm mt-1">
          Solicitudes en periodo de gracia y archivo de cuentas eliminadas.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            tab === 'pending'
              ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30'
              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pendientes
          {pendingRows.length > 0 && (
            <span className="bg-orange-500/30 text-orange-300 text-xs px-2 py-0.5 rounded-full">
              {pendingRows.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('deleted')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            tab === 'deleted'
              ? 'bg-rose-700/20 text-rose-400 border border-rose-600/30'
              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          Eliminados
          {tab === 'deleted' && totalDeleted > 0 && (
            <span className="bg-rose-700/30 text-rose-300 text-xs px-2 py-0.5 rounded-full">
              {totalDeleted}
            </span>
          )}
        </button>
      </div>

      {/* Mensaje de acción */}
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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── TAB: PENDIENTES ── */}
      {tab === 'pending' && (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
            </div>
          ) : pendingRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/50" />
              <p className="text-sm">No hay solicitudes de baja pendientes.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase bg-slate-900/40 border-b border-white/5">
                    <th className="text-left px-5 py-3 font-medium">Usuario</th>
                    <th className="text-left px-5 py-3 font-medium">Solicitado</th>
                    <th className="text-left px-5 py-3 font-medium">Eliminación</th>
                    <th className="text-left px-5 py-3 font-medium">Días restantes</th>
                    <th className="text-left px-5 py-3 font-medium">Motivo</th>
                    <th className="text-left px-5 py-3 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pendingRows.map(row => (
                    <tr key={row.request_id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium text-white">{row.user_email}</p>
                        {row.request_ip && (
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{row.request_ip}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-400">{fmtDateTime(row.requested_at)}</td>
                      <td className="px-5 py-4 text-orange-400 font-medium">{fmtDate(row.scheduled_for)}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          row.days_remaining <= 3
                            ? 'bg-red-700/40 text-red-300'
                            : row.days_remaining <= 7
                              ? 'bg-orange-700/40 text-orange-300'
                              : 'bg-slate-700 text-slate-300'
                        }`}>
                          {row.days_remaining}d
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-400 max-w-xs">
                        <span className="truncate block max-w-[200px]" title={row.reason ?? ''}>
                          {row.reason ?? <span className="text-slate-600 italic">Sin motivo</span>}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={cancelNote[row.request_id] ?? ''}
                            onChange={e => setCancelNote(p => ({ ...p, [row.request_id]: e.target.value }))}
                            placeholder="Nota (opcional)"
                            className="bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white w-36 focus:outline-none focus:border-purple-500 placeholder-slate-600"
                          />
                          <button
                            onClick={() => handleCancel(row.request_id)}
                            disabled={cancelling === row.request_id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-50 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-colors"
                          >
                            {cancelling === row.request_id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <XCircle className="w-3.5 h-3.5" />}
                            Cancelar baja
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ELIMINADOS ── */}
      {tab === 'deleted' && (
        <div className="space-y-4">

          {/* Buscador */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput); }}
              placeholder="Buscar por email o nombre…"
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500 placeholder-slate-500"
            />
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
              </div>
            ) : deletedRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                <UserX className="w-10 h-10 opacity-30" />
                <p className="text-sm">
                  {search ? 'Sin resultados para esa búsqueda.' : 'No hay cuentas eliminadas aún.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs uppercase bg-slate-900/40 border-b border-white/5">
                      <th className="text-left px-5 py-3 font-medium">Usuario</th>
                      <th className="text-left px-5 py-3 font-medium">Plan</th>
                      <th className="text-left px-5 py-3 font-medium">Docs</th>
                      <th className="text-left px-5 py-3 font-medium">Motivo</th>
                      <th className="text-left px-5 py-3 font-medium">Solicitado</th>
                      <th className="text-left px-5 py-3 font-medium">Eliminado</th>
                      <th className="text-left px-5 py-3 font-medium">Retener hasta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {deletedRows.map(row => (
                      <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-white">{row.full_name || row.email}</p>
                          <p className="text-xs text-slate-500">{row.email}</p>
                        </td>
                        <td className="px-5 py-4">
                          {row.plan_type ? (
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${
                              PLAN_BADGE[row.plan_type] ?? 'bg-slate-700 text-slate-300'
                            }`}>
                              {row.plan_type}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-400 tabular-nums">
                          {row.doc_count ?? 0}
                        </td>
                        <td className="px-5 py-4 text-slate-400 max-w-xs">
                          <span className="truncate block max-w-[180px]" title={row.deletion_reason ?? ''}>
                            {row.deletion_reason ?? <span className="text-slate-600 italic">—</span>}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {row.requested_at ? fmtDate(row.requested_at) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-4 text-rose-400 font-medium">{fmtDate(row.executed_at)}</td>
                        <td className="px-5 py-4 text-slate-500 text-xs">{fmtDate(row.retain_until)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Paginación */}
          {totalDeleted > LIMIT && (
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>
                Mostrando {offset + 1}–{Math.min(offset + LIMIT, totalDeleted)} de {totalDeleted}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                  disabled={offset === 0}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors text-xs"
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </button>
                <span className="flex items-center px-3 text-xs text-slate-500">
                  Pág. {page} / {totalPages}
                </span>
                <button
                  onClick={() => setOffset(o => o + LIMIT)}
                  disabled={offset + LIMIT >= totalDeleted}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors text-xs"
                >
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
