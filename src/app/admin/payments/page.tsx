"use client";

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Payment {
  id: string;
  user_email: string;
  user_full_name: string;
  amount_cop: number;
  billing_cycle: string;
  status: string;
  payment_method_type: string | null;
  failure_reason: string | null;
  mp_payment_id: string | null;
  created_at: string;
  processed_at: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  approved:    'bg-green-700/40 text-green-300',
  pending:     'bg-yellow-700/40 text-yellow-300',
  rejected:    'bg-red-700/40 text-red-300',
  cancelled:   'bg-slate-700/60 text-slate-400',
  refunded:    'bg-blue-700/40 text-blue-300',
  in_mediation:'bg-orange-700/40 text-orange-300',
};

const STATUSES = ['', 'approved', 'pending', 'rejected', 'cancelled', 'refunded', 'in_mediation'];

function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState('');
  const [page, setPage]         = useState(0);
  const limit = 20;

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
    if (status) params.set('status', status);
    const res = await fetch(`/api/admin/payments?${params}`);
    if (res.ok) {
      const d = await res.json();
      setPayments(d.payments ?? []);
      setTotal(d.total ?? 0);
    }
    setLoading(false);
  }, [status, page]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pagos</h1>
        <p className="text-slate-400 text-sm mt-1">{total} órdenes en total</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        {STATUSES.map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(0); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${
              status === s ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}>
            {s || 'Todos'}
          </button>
        ))}
      </div>

      <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="w-7 h-7 animate-spin text-purple-400" /></div>
        ) : payments.length === 0 ? (
          <p className="text-center text-slate-500 py-16">Sin resultados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase border-b border-white/5 bg-slate-900/40">
                  {['Usuario', 'Monto', 'Ciclo', 'Método', 'Estado', 'ID MercadoPago', 'Fecha'].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{p.user_full_name || '—'}</p>
                      <p className="text-xs text-slate-500">{p.user_email}</p>
                    </td>
                    <td className="px-5 py-4 font-semibold text-green-400">{fmtCOP(p.amount_cop)}</td>
                    <td className="px-5 py-4 capitalize text-slate-300">{p.billing_cycle}</td>
                    <td className="px-5 py-4 text-slate-400">{p.payment_method_type ?? '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold capitalize ${STATUS_BADGE[p.status] ?? 'bg-slate-700 text-slate-300'}`}>
                        {p.status}
                      </span>
                      {p.failure_reason && <p className="text-xs text-red-400 mt-1">{p.failure_reason}</p>}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{p.mp_payment_id ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-400 text-xs">{fmtDate(p.created_at)}</td>
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
