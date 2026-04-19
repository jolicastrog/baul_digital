"use client";

import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface AuditLog {
  id: string;
  user_email: string;
  user_full_name: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminAuditPage() {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction]   = useState('');
  const [query, setQuery]     = useState('');
  const [page, setPage]       = useState(0);
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
    if (query) params.set('action', query);
    const res = await fetch(`/api/admin/audit?${params}`);
    if (res.ok) {
      const d = await res.json();
      setLogs(d.logs ?? []);
      setTotal(d.total ?? 0);
    }
    setLoading(false);
  }, [query, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Auditoría</h1>
        <p className="text-slate-400 text-sm mt-1">{total} eventos registrados</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); setPage(0); setQuery(action); }} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={action} onChange={e => setAction(e.target.value)}
            placeholder="Filtrar por acción (ej. LOGIN, UPLOAD)…"
            className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500" />
        </div>
        <button type="submit" className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors">Filtrar</button>
        {query && (
          <button type="button" onClick={() => { setAction(''); setQuery(''); setPage(0); }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors">
            Limpiar
          </button>
        )}
      </form>

      <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-7 h-7 animate-spin text-purple-400" /></div>
        ) : logs.length === 0 ? (
          <p className="text-center text-slate-500 py-16">Sin registros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase border-b border-white/5 bg-slate-900/40">
                  {['Fecha', 'Usuario', 'Acción', 'Recurso', 'IP', 'Detalles'].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(log.created_at)}</td>
                    <td className="px-5 py-3">
                      <p className="text-white text-xs font-medium">{log.user_full_name || '—'}</p>
                      <p className="text-slate-500 text-xs">{log.user_email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded text-purple-300">{log.action}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs capitalize">{log.resource_type}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{log.ip_address ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs max-w-xs">
                      {log.details ? (
                        <span className="font-mono truncate block">{JSON.stringify(log.details)}</span>
                      ) : '—'}
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
