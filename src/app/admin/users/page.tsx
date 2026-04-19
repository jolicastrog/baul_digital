"use client";

import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, UserCheck, UserX, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  cedula_unica: string;
  cedula_tipo: string;
  plan_type: string;
  is_active: boolean;
  is_admin: boolean;
  storage_used: number;
  doc_count: number;
  created_at: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PLAN_BADGE: Record<string, string> = {
  free:       'bg-slate-700 text-slate-300',
  premium:    'bg-purple-700/60 text-purple-200',
  enterprise: 'bg-amber-700/60 text-amber-200',
};

export default function AdminUsersPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [query, setQuery]     = useState('');
  const [page, setPage]       = useState(0);
  const [acting, setActing]   = useState<string | null>(null);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
    if (query) params.set('search', query);
    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users ?? []);
      setTotal(d.total ?? 0);
    }
    setLoading(false);
  }, [query, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setQuery(search);
  };

  const patchUser = async (id: string, action: 'toggle_active' | 'set_admin', value: boolean) => {
    setActing(id + action);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, value }),
    });
    if (res.ok) await fetchUsers();
    setActing(null);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-slate-400 text-sm mt-1">{total} usuarios registrados</p>
        </div>
      </div>

      {/* Búsqueda */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o cédula…"
            className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <button type="submit" className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors">
          Buscar
        </button>
        {query && (
          <button type="button" onClick={() => { setSearch(''); setQuery(''); setPage(0); }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors">
            Limpiar
          </button>
        )}
      </form>

      {/* Tabla */}
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-slate-500 py-16">Sin resultados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase border-b border-white/5 bg-slate-900/40">
                  <th className="text-left px-5 py-3 font-medium">Usuario</th>
                  <th className="text-left px-5 py-3 font-medium">Cédula</th>
                  <th className="text-left px-5 py-3 font-medium">Plan</th>
                  <th className="text-left px-5 py-3 font-medium">Docs</th>
                  <th className="text-left px-5 py-3 font-medium">Registro</th>
                  <th className="text-left px-5 py-3 font-medium">Estado</th>
                  <th className="text-left px-5 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map(u => (
                  <tr key={u.id} className={`transition-colors hover:bg-white/[0.02] ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{u.full_name || '—'}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      <span className="text-xs font-mono">{u.cedula_tipo} {u.cedula_unica}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold capitalize ${PLAN_BADGE[u.plan_type] ?? PLAN_BADGE.free}`}>
                        {u.plan_type}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-300">{u.doc_count}</td>
                    <td className="px-5 py-4 text-slate-400 text-xs">{fmtDate(u.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-medium ${u.is_active ? 'text-green-400' : 'text-red-400'}`}>
                          {u.is_active ? 'Activo' : 'Suspendido'}
                        </span>
                        {u.is_admin && <span className="text-xs text-purple-400 font-medium">Admin</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => patchUser(u.id, 'toggle_active', !u.is_active)}
                          disabled={acting === u.id + 'toggle_active'}
                          title={u.is_active ? 'Suspender' : 'Reactivar'}
                          className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'text-red-400 hover:bg-red-400/10' : 'text-green-400 hover:bg-green-400/10'}`}
                        >
                          {acting === u.id + 'toggle_active'
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />
                          }
                        </button>
                        <button
                          onClick={() => patchUser(u.id, 'set_admin', !u.is_admin)}
                          disabled={acting === u.id + 'set_admin'}
                          title={u.is_admin ? 'Revocar admin' : 'Promover a admin'}
                          className={`p-1.5 rounded-lg transition-colors ${u.is_admin ? 'text-purple-400 hover:bg-purple-400/10' : 'text-slate-400 hover:bg-white/10'}`}
                        >
                          {acting === u.id + 'set_admin'
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : u.is_admin ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />
                          }
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

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Mostrando {page * limit + 1}–{Math.min((page + 1) * limit, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
