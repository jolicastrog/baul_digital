'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, Shield, Lock, HardDrive, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  cedula_unica: string;
  cedula_tipo: string;
  phone: string | null;
  plan_type: string;
  storage_used_bytes: number;
  storage_quota_bytes: number;
};

const CEDULA_TIPOS = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'NIT', label: 'NIT' },
];

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:       { label: 'Gratuito',    color: 'bg-slate-700 text-slate-300' },
  premium:    { label: 'Premium',     color: 'bg-blue-600/20 text-blue-400 border border-blue-500/30' },
  enterprise: { label: 'Enterprise',  color: 'bg-purple-600/20 text-purple-400 border border-purple-500/30' },
};

function bytesToMB(b: number) { return (b / 1024 / 1024).toFixed(1); }

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado formulario datos personales
  const [fullName, setFullName] = useState('');
  const [cedulaUnica, setCedulaUnica] = useState('');
  const [cedulaTipo, setCedulaTipo] = useState('CC');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estado formulario contraseña
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        if (data.profile) {
          const p = data.profile as Profile;
          setProfile(p);
          setFullName(p.full_name ?? '');
          setCedulaUnica(p.cedula_unica ?? '');
          setCedulaTipo(p.cedula_tipo ?? 'CC');
          setPhone(p.phone ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, cedula_unica: cedulaUnica, cedula_tipo: cedulaTipo, phone }),
    });

    const data = await res.json();
    if (res.ok) {
      setProfile(prev => prev ? { ...prev, ...data.profile } : data.profile);
      setProfileMsg({ type: 'success', text: 'Perfil actualizado correctamente.' });
    } else {
      setProfileMsg({ type: 'error', text: data.error || 'Error al guardar.' });
    }
    setSavingProfile(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Mínimo 8 caracteres.' });
      return;
    }

    setSavingPassword(true);
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await res.json();
    if (res.ok) {
      setPasswordMsg({ type: 'success', text: 'Contraseña actualizada correctamente.' });
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordMsg({ type: 'error', text: data.error || 'Error al cambiar contraseña.' });
    }
    setSavingPassword(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando perfil...
      </div>
    );
  }

  const planInfo = PLAN_LABELS[profile?.plan_type ?? 'free'];
  const storagePercent = profile
    ? Math.min(100, (profile.storage_used_bytes / profile.storage_quota_bytes) * 100)
    : 0;

  return (
    <div className="space-y-8 pb-12 max-w-2xl">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Configuración</h1>
        <p className="text-slate-400 mt-1">Administra tu información personal y seguridad.</p>
      </header>

      {/* ── Resumen de cuenta ── */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center text-2xl font-bold text-blue-400 uppercase flex-shrink-0">
          {(profile?.full_name ?? profile?.email ?? 'U')[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xl font-semibold text-white truncate">{profile?.full_name || '—'}</p>
          <p className="text-slate-400 text-sm truncate">{profile?.email}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${planInfo.color}`}>
          {planInfo.label}
        </span>
      </div>

      {/* ── Almacenamiento ── */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <HardDrive className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-white">Almacenamiento</h2>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${storagePercent > 90 ? 'bg-red-500' : storagePercent > 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>
        <p className="text-sm text-slate-400">
          {bytesToMB(profile?.storage_used_bytes ?? 0)} MB usados de{' '}
          {bytesToMB(profile?.storage_quota_bytes ?? 0)} MB —{' '}
          <span className="text-slate-300 font-medium">{storagePercent.toFixed(1)}% utilizado</span>
        </p>
      </div>

      {/* ── Datos personales ── */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <User className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-white">Datos Personales</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-5">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre completo</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Tu nombre completo"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
            />
          </div>

          {/* Email (solo lectura) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo electrónico</label>
            <input
              type="email"
              value={profile?.email ?? ''}
              disabled
              className="w-full bg-slate-800/50 border border-white/5 rounded-xl px-4 py-3 text-slate-500 text-sm cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">El correo no se puede cambiar desde aquí.</p>
          </div>

          {/* Cédula */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo</label>
              <select
                value={cedulaTipo}
                onChange={e => setCedulaTipo(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
              >
                {CEDULA_TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.value}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Número de cédula</label>
              <input
                type="text"
                value={cedulaUnica}
                onChange={e => setCedulaUnica(e.target.value)}
                placeholder="Ej: 79790374"
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
              />
            </div>
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Teléfono (opcional)</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ej: 3001234567"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
            />
          </div>

          {/* Mensaje de resultado */}
          {profileMsg && (
            <div className={`flex items-start gap-3 rounded-xl p-4 text-sm ${
              profileMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {profileMsg.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              {profileMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-blue-500/20"
          >
            {savingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar cambios
          </button>
        </form>
      </div>

      {/* ── Seguridad ── */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-white">Cambiar Contraseña</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
            />
          </div>

          {passwordMsg && (
            <div className={`flex items-start gap-3 rounded-xl p-4 text-sm ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {passwordMsg.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              {passwordMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={savingPassword}
            className="flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-blue-500/20"
          >
            {savingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Cambiar contraseña
          </button>
        </form>
      </div>

      {/* ── Plan actual ── */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-white">Plan Actual</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">{planInfo.label}</p>
            <p className="text-slate-400 text-sm mt-0.5">
              {bytesToMB(profile?.storage_quota_bytes ?? 0)} MB de almacenamiento
            </p>
          </div>
          {profile?.plan_type === 'free' && (
            <Link
              href="/dashboard/pricing"
              className="px-5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-sm font-medium transition-colors"
            >
              Ver planes →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
