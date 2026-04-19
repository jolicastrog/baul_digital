"use client";

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface FraudAlert {
  id: string;
  user_email: string;
  user_full_name: string;
  alert_type: string;
  severity: string;
  details: Record<string, unknown> | null;
  reviewed: boolean;
  created_at: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-700/50 text-red-200',
  high:     'bg-orange-700/50 text-orange-200',
  medium:   'bg-yellow-700/50 text-yellow-200',
  low:      'bg-slate-700 text-slate-300',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminFraudPage() {
  const [alerts, setAlerts]   = useState<FraudAlert[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [onlyActive, setOnlyActive] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [page, setPage]       = useState(0);
  const limit = 50;

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(limit), offset: String(page * limit),
      only_active: String(onlyActive),
    });
    const res = await fetch(`/api/admin/fraud?${params}`);
    if (res.ok) {
      const d = await res.json();
      setAlerts(d.alerts ?? []);
      setTotal(d.total ?? 0);
    }
    setLoading(false);
  }, [onlyActive, page]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const markReviewed = async (id: string) => {
    setMarking(id);
    const res = await fetch(`/api/admin/fraud/${id}`, { method: 'PATCH' });
    if (res.ok) await fetchAlerts();
    setMarking(null);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Detección de Fraude</h1>
          <p className="text-slate-400 text-sm mt-1">{total} alertas {onlyActive ? 'pendientes' : 'totales'}</p>
        </div>
        <button
          onClick={() => { setOnlyActive(v => !v); setPage(0); }}
          className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
            onlyActive ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {onlyActive ? 'Mostrando: Pendientes' : 'Mostrando: Todas'}
        </button>
      </div>

      <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-7 h-7 animate-spin text-purple-400" /></div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">Sin alertas pendientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase border-b border-white/5 bg-slate-900/40">
                  {['Severidad', 'Usuario', 'Tipo de alerta', 'Detalles', 'Fecha', 'Estado', 'Acción'].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {alerts.map(alert => (
                  <tr key={alert.id} className={`hover:bg-white/[0.02] transition-colors ${alert.reviewed ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold capitalize ${SEVERITY_BADGE[alert.severity] ?? SEVERITY_BADGE.low}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{alert.user_full_name || '—'}</p>
                      <p className="text-xs text-slate-500">{alert.user_email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded text-orange-300">{alert.alert_type}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs max-w-xs">
                      {alert.details ? <span className="font-mono truncate block">{JSON.stringify(alert.details)}</span> : '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs whitespace-nowrap">{fmtDate(alert.created_at)}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium ${alert.reviewed ? 'text-green-400' : 'text-yellow-400'}`}>
                        {alert.reviewed ? 'Revisada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {!alert.reviewed && (
                        <button onClick={() => markReviewed(alert.id)} disabled={marking === alert.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700/30 hover:bg-green-700/50 text-green-300 text-xs font-medium rounded-lg transition-colors">
                          {marking === alert.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Marcar revisada
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Mostrando {page * limit + 1}–{Math.min((page + 1) * limit, total)} de {total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
