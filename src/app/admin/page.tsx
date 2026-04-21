"use client";

import { useEffect, useState } from 'react';
import { Users, FileText, HardDrive, TrendingUp, UserCheck, UserX, ShieldCheck, DollarSign, Loader2, Clock, Trash2 } from 'lucide-react';

interface Stats {
  total_users: number;
  active_users: number;
  suspended_users: number;
  admin_users: number;
  pending_deletions: number;
  total_deleted_users: number;
  total_documents: number;
  total_storage_bytes: number;
  new_users_today: number;
  new_users_month: number;
  subscriptions_by_plan: Record<string, number>;
  revenue_month_cop: number;
  revenue_total_cop: number;
  recent_payments: Array<{
    id: string;
    email: string;
    full_name: string;
    amount_cop: number;
    billing_cycle: string;
    status: string;
    created_at: string;
  }> | null;
}

function fmtBytes(b: number) {
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  return (b / 1e3).toFixed(0) + ' KB';
}

function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-slate-400 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setStats(d.stats))
      .catch(() => setError('Error al cargar estadísticas.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  );

  if (error) return (
    <div className="text-red-400 bg-red-400/10 rounded-xl p-4">{error}</div>
  );

  if (!stats) return null;

  const planColors: Record<string, string> = { free: 'bg-slate-700', premium: 'bg-purple-700', enterprise: 'bg-amber-700' };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Vista general del sistema</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}      label="Usuarios totales"  value={stats.total_users}        sub={`+${stats.new_users_today} hoy`}    color="bg-blue-600" />
        <StatCard icon={UserCheck}  label="Activos"           value={stats.active_users}       sub={`${stats.new_users_month} este mes`} color="bg-green-600" />
        <StatCard icon={FileText}   label="Documentos"        value={stats.total_documents}    color="bg-indigo-600" />
        <StatCard icon={HardDrive}  label="Almacenamiento"    value={fmtBytes(stats.total_storage_bytes)} color="bg-cyan-700" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Ingresos del mes"  value={fmtCOP(stats.revenue_month_cop)}  color="bg-emerald-600" />
        <StatCard icon={DollarSign} label="Ingresos totales"  value={fmtCOP(stats.revenue_total_cop)}  color="bg-teal-700" />
        <StatCard icon={UserX}      label="Suspendidos"       value={stats.suspended_users}    color="bg-red-700" />
        <StatCard icon={ShieldCheck}label="Administradores"   value={stats.admin_users}        color="bg-purple-700" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Bajas pendientes"
          value={stats.pending_deletions ?? 0}
          sub="En periodo de gracia"
          color="bg-orange-600"
        />
        <StatCard
          icon={Trash2}
          label="Cuentas eliminadas"
          value={stats.total_deleted_users ?? 0}
          sub="Historial total"
          color="bg-rose-800"
        />
      </div>

      {/* Distribución por plan */}
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Usuarios por plan</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.subscriptions_by_plan ?? {}).map(([plan, count]) => (
            <div key={plan} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white ${planColors[plan] ?? 'bg-slate-700'}`}>
              <span className="capitalize">{plan}</span>
              <span className="bg-black/20 px-2 py-0.5 rounded-lg">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Últimos pagos */}
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Últimos pagos aprobados</h2>
        {!stats.recent_payments?.length ? (
          <p className="text-slate-500 text-sm">Sin pagos recientes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase border-b border-white/5">
                  <th className="text-left pb-3 font-medium">Usuario</th>
                  <th className="text-left pb-3 font-medium">Monto</th>
                  <th className="text-left pb-3 font-medium">Ciclo</th>
                  <th className="text-left pb-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.recent_payments.map(p => (
                  <tr key={p.id} className="text-slate-300">
                    <td className="py-3">
                      <p className="font-medium text-white">{p.full_name || p.email}</p>
                      <p className="text-xs text-slate-500">{p.email}</p>
                    </td>
                    <td className="py-3 font-semibold text-green-400">{fmtCOP(p.amount_cop)}</td>
                    <td className="py-3 capitalize">{p.billing_cycle}</td>
                    <td className="py-3 text-slate-400">{fmtDate(p.created_at)}</td>
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
