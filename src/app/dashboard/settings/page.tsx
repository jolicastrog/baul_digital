'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  User, Shield, Lock, HardDrive, Tag,
  CheckCircle2, AlertCircle, Loader2,
  Eye, EyeOff, XCircle,
} from 'lucide-react';
import CategoryManager from '@/components/CategoryManager';

// ── Tipos ──────────────────────────────────────────────────────────────────
type CedulaTipo = 'CC' | 'TI' | 'RC' | 'CE' | 'PA' | 'NIT' | 'PEP' | 'PPT';

type Profile = {
  id:                  string;
  email:               string;
  nombres:             string | null;
  apellidos:           string | null;
  full_name:           string | null;
  cedula_unica:        string;
  cedula_tipo:         string;
  phone:               string | null;
  plan_type:           string;
  storage_used_bytes:  number;
  storage_quota_bytes: number;
};

// ── Constantes ─────────────────────────────────────────────────────────────
const CEDULA_TIPOS: { value: CedulaTipo; label: string }[] = [
  { value: 'CC',  label: 'CC – Cédula Ciudadanía' },
  { value: 'TI',  label: 'TI – Tarjeta Identidad' },
  { value: 'RC',  label: 'RC – Registro Civil' },
  { value: 'CE',  label: 'CE – Cédula Extranjería' },
  { value: 'PA',  label: 'PA – Pasaporte' },
  { value: 'NIT', label: 'NIT – NIT Empresarial' },
  { value: 'PEP', label: 'PEP – Perm. Especial' },
  { value: 'PPT', label: 'PPT – Perm. Protección' },
];

const CEDULA_RULES: Record<CedulaTipo, { pattern: RegExp; msg: string; placeholder: string; maxLen: number; inputMode: 'numeric' | 'text' }> = {
  CC:  { pattern: /^\d{5,10}$/,           msg: 'Solo números, entre 5 y 10 dígitos',             placeholder: 'Ej. 79790374',   maxLen: 10, inputMode: 'numeric' },
  TI:  { pattern: /^\d{10}$/,             msg: 'Solo números, exactamente 10 dígitos',            placeholder: 'Ej. 1020304050', maxLen: 10, inputMode: 'numeric' },
  RC:  { pattern: /^\d{8,11}$/,           msg: 'Solo números, entre 8 y 11 dígitos',              placeholder: 'Ej. 12345678',   maxLen: 11, inputMode: 'numeric' },
  CE:  { pattern: /^[A-Za-z0-9]{4,15}$/,  msg: 'Alfanumérico, entre 4 y 15 caracteres',          placeholder: 'Ej. 123456AB',   maxLen: 15, inputMode: 'text' },
  PA:  { pattern: /^[A-Za-z0-9]{5,20}$/,  msg: 'Alfanumérico, entre 5 y 20 caracteres',          placeholder: 'Ej. AB123456',   maxLen: 20, inputMode: 'text' },
  NIT: { pattern: /^\d{8,11}$/,           msg: 'Solo números, entre 8 y 11 dígitos (sin guión)', placeholder: 'Ej. 9001234567', maxLen: 11, inputMode: 'numeric' },
  PEP: { pattern: /^[A-Za-z0-9]{4,20}$/,  msg: 'Alfanumérico, entre 4 y 20 caracteres',          placeholder: 'Ej. PEP1234567', maxLen: 20, inputMode: 'text' },
  PPT: { pattern: /^[A-Za-z0-9]{4,20}$/,  msg: 'Alfanumérico, entre 4 y 20 caracteres',          placeholder: 'Ej. PPT1234567', maxLen: 20, inputMode: 'text' },
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:       { label: 'Gratuito',   color: 'bg-slate-700 text-slate-300' },
  premium:    { label: 'Premium',    color: 'bg-blue-600/20 text-blue-400 border border-blue-500/30' },
  enterprise: { label: 'Enterprise', color: 'bg-purple-600/20 text-purple-400 border border-purple-500/30' },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function bytesToMB(b: number) { return (b / 1024 / 1024).toFixed(1); }

function getPasswordStrength(pw: string) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8)           score++;
  if (pw.length >= 12)          score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;
  if (score <= 2) return { label: 'Débil',  color: 'bg-red-500',    width: '33%',  textColor: 'text-red-400' };
  if (score <= 3) return { label: 'Media',  color: 'bg-yellow-500', width: '66%',  textColor: 'text-yellow-400' };
  return              { label: 'Fuerte', color: 'bg-emerald-500', width: '100%', textColor: 'text-emerald-400' };
}

// ── Sub-componentes ────────────────────────────────────────────────────────
function RequiredMark() {
  return <span className="text-red-400 ml-1">*</span>;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
      <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {msg}
    </p>
  );
}

function inputCls(error?: string) {
  return `w-full bg-slate-800 border rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500
    focus:outline-none focus:ring-2 transition-all text-sm
    ${error ? 'border-red-500/60 focus:ring-red-500/40' : 'border-white/10 focus:ring-blue-500/50'}`;
}

// ── Página ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Formulario perfil
  const [nombres,     setNombres]     = useState('');
  const [apellidos,   setApellidos]   = useState('');
  const [cedulaUnica, setCedulaUnica] = useState('');
  const [cedulaTipo,  setCedulaTipo]  = useState<CedulaTipo>('CC');
  const [phone,       setPhone]       = useState('');

  const [profileErrors,  setProfileErrors]  = useState<Record<string, string>>({});
  const [profileTouched, setProfileTouched] = useState<Record<string, boolean>>({});
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [profileMsg,     setProfileMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulario contraseña
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);

  const [passwordErrors,  setPasswordErrors]  = useState<Record<string, string>>({});
  const [passwordTouched, setPasswordTouched] = useState<Record<string, boolean>>({});
  const [savingPassword,  setSavingPassword]  = useState(false);
  const [passwordMsg,     setPasswordMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/profile')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'no_auth' : `HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.profile) {
          const p = data.profile as Profile;
          setProfile(p);
          setNombres(p.nombres ?? '');
          setApellidos(p.apellidos ?? '');
          setCedulaUnica(p.cedula_unica ?? '');
          setCedulaTipo((p.cedula_tipo as CedulaTipo) ?? 'CC');
          setPhone(p.phone ?? '');
        } else {
          setLoadError('No se encontró el perfil. Intenta cerrar sesión y volver a ingresar.');
        }
      })
      .catch(err => {
        console.error('Error cargando perfil:', err);
        if (err.message === 'no_auth') {
          setLoadError('Tu sesión expiró. Cierra sesión e inicia de nuevo.');
        } else {
          setLoadError('No se pudo cargar el perfil. Recarga la página.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Validaciones ─────────────────────────────────────────────────────────
  const validateProfileField = (field: string, value: string, tipo?: CedulaTipo): string => {
    switch (field) {
      case 'nombres':
        if (!value.trim()) return 'Los nombres son obligatorios.';
        if (!/^[A-Za-záéíóúÁÉÍÓÚüÜñÑ\s]{2,60}$/.test(value.trim())) return 'Solo letras y espacios, entre 2 y 60 caracteres.';
        return '';
      case 'apellidos':
        if (!value.trim()) return 'Los apellidos son obligatorios.';
        if (!/^[A-Za-záéíóúÁÉÍÓÚüÜñÑ\s]{2,60}$/.test(value.trim())) return 'Solo letras y espacios, entre 2 y 60 caracteres.';
        return '';
      case 'cedulaUnica': {
        const rule = CEDULA_RULES[tipo ?? cedulaTipo];
        if (!value.trim())                 return 'El número de documento es obligatorio.';
        if (!rule.pattern.test(value.trim())) return rule.msg;
        return '';
      }
      case 'phone':
        if (value && !/^[+\d\s\-()]{7,20}$/.test(value)) return 'Formato inválido. Ej: 3001234567 o +57 300 1234567';
        if (value && value.replace(/\D/g, '').length < 7) return 'Mínimo 7 dígitos.';
        return '';
      default:
        return '';
    }
  };

  const validatePasswordField = (field: string, value: string): string => {
    switch (field) {
      case 'newPassword':
        if (!value)              return 'La contraseña es obligatoria.';
        if (value.length < 8)    return 'Mínimo 8 caracteres.';
        if (value.length > 72)   return 'Máximo 72 caracteres.';
        if (!/[A-Z]/.test(value)) return 'Debe incluir al menos una letra mayúscula.';
        if (!/[0-9]/.test(value)) return 'Debe incluir al menos un número.';
        return '';
      case 'confirmPassword':
        if (!value)                  return 'Confirma tu contraseña.';
        if (value !== newPassword)   return 'Las contraseñas no coinciden.';
        return '';
      default:
        return '';
    }
  };

  // ── Handlers perfil ──────────────────────────────────────────────────────
  const handleProfileBlur = (field: string, value: string) => {
    setProfileTouched(p => ({ ...p, [field]: true }));
    const err = validateProfileField(field, value);
    setProfileErrors(p => ({ ...p, [field]: err }));
  };

  const handleCedulaTipoChange = (newTipo: CedulaTipo) => {
    setCedulaTipo(newTipo);
    setCedulaUnica('');
    setProfileErrors(p => ({ ...p, cedulaUnica: '' }));
    setProfileTouched(p => ({ ...p, cedulaUnica: false }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    const fields = { nombres, apellidos, cedulaUnica, phone };
    const newErrors: Record<string, string> = {};
    Object.entries(fields).forEach(([k, v]) => {
      const err = validateProfileField(k, v);
      if (err) newErrors[k] = err;
    });
    setProfileTouched({ nombres: true, apellidos: true, cedulaUnica: true, phone: true });
    setProfileErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSavingProfile(true);
    const res = await fetch('/api/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nombres:      nombres.trim(),
        apellidos:    apellidos.trim(),
        cedula_unica: cedulaUnica.trim(),
        cedula_tipo:  cedulaTipo,
        phone:        phone.trim() || null,
      }),
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

  // ── Handlers contraseña ──────────────────────────────────────────────────
  const handlePasswordBlur = (field: string, value: string) => {
    setPasswordTouched(p => ({ ...p, [field]: true }));
    const err = validatePasswordField(field, value);
    setPasswordErrors(p => ({ ...p, [field]: err }));
  };

  const handleNewPasswordChange = (val: string) => {
    setNewPassword(val);
    if (passwordTouched.newPassword)
      setPasswordErrors(p => ({ ...p, newPassword: validatePasswordField('newPassword', val) }));
    if (passwordTouched.confirmPassword)
      setPasswordErrors(p => ({ ...p, confirmPassword: confirmPassword !== val ? 'Las contraseñas no coinciden.' : '' }));
  };

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    if (passwordTouched.confirmPassword)
      setPasswordErrors(p => ({ ...p, confirmPassword: validatePasswordField('confirmPassword', val) }));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    const newErr     = validatePasswordField('newPassword',     newPassword);
    const confirmErr = validatePasswordField('confirmPassword', confirmPassword);
    setPasswordTouched({ newPassword: true, confirmPassword: true });
    setPasswordErrors({ newPassword: newErr, confirmPassword: confirmErr });
    if (newErr || confirmErr) return;

    setSavingPassword(true);
    const res = await fetch('/api/profile', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setPasswordMsg({ type: 'success', text: 'Contraseña actualizada correctamente.' });
      setNewPassword('');
      setConfirmPassword('');
      setPasswordTouched({});
      setPasswordErrors({});
    } else {
      setPasswordMsg({ type: 'error', text: data.error || 'Error al cambiar contraseña.' });
    }
    setSavingPassword(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando perfil...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-3 p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 max-w-lg mt-8">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">{loadError}</p>
      </div>
    );
  }

  const planInfo       = PLAN_LABELS[profile?.plan_type ?? 'free'];
  const storagePercent = profile
    ? Math.min(100, (profile.storage_used_bytes / profile.storage_quota_bytes) * 100)
    : 0;
  const rule           = CEDULA_RULES[cedulaTipo];
  const pwStrength     = getPasswordStrength(newPassword);

  return (
    <div className="space-y-8 pb-12 max-w-2xl">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Configuración</h1>
        <p className="text-slate-400 mt-1">Administra tu información personal y seguridad.</p>
      </header>

      {/* Resumen de cuenta */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center text-2xl font-bold text-blue-400 uppercase flex-shrink-0">
          {(profile?.nombres ?? profile?.full_name ?? profile?.email ?? 'U')[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xl font-semibold text-white truncate">
            {profile?.nombres && profile?.apellidos
              ? `${profile.nombres} ${profile.apellidos}`
              : profile?.full_name || '—'}
          </p>
          <p className="text-slate-400 text-sm truncate">{profile?.email}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${planInfo.color}`}>
          {planInfo.label}
        </span>
      </div>

      {/* Almacenamiento */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <HardDrive className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-white">Almacenamiento</h2>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              storagePercent > 90 ? 'bg-red-500' : storagePercent > 70 ? 'bg-yellow-500' : 'bg-blue-500'
            }`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>
        <p className="text-sm text-slate-400">
          {bytesToMB(profile?.storage_used_bytes ?? 0)} MB usados de{' '}
          {bytesToMB(profile?.storage_quota_bytes ?? 0)} MB —{' '}
          <span className="text-slate-300 font-medium">{storagePercent.toFixed(1)}% utilizado</span>
        </p>
      </div>

      {/* Datos personales */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-white">Datos Personales</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Los campos con <span className="text-red-400">*</span> son obligatorios.
        </p>

        <form onSubmit={handleSaveProfile} className="space-y-5" noValidate>

          {/* Nombres + Apellidos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Nombres <RequiredMark />
              </label>
              <input
                type="text"
                value={nombres}
                onChange={e => {
                  setNombres(e.target.value);
                  if (profileTouched.nombres)
                    setProfileErrors(p => ({ ...p, nombres: validateProfileField('nombres', e.target.value) }));
                }}
                onBlur={() => handleProfileBlur('nombres', nombres)}
                maxLength={60}
                placeholder="Ej. Juan Carlos"
                autoComplete="given-name"
                className={inputCls(profileTouched.nombres ? profileErrors.nombres : undefined)}
              />
              <FieldError msg={profileTouched.nombres ? profileErrors.nombres : undefined} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Apellidos <RequiredMark />
              </label>
              <input
                type="text"
                value={apellidos}
                onChange={e => {
                  setApellidos(e.target.value);
                  if (profileTouched.apellidos)
                    setProfileErrors(p => ({ ...p, apellidos: validateProfileField('apellidos', e.target.value) }));
                }}
                onBlur={() => handleProfileBlur('apellidos', apellidos)}
                maxLength={60}
                placeholder="Ej. Pérez Gómez"
                autoComplete="family-name"
                className={inputCls(profileTouched.apellidos ? profileErrors.apellidos : undefined)}
              />
              <FieldError msg={profileTouched.apellidos ? profileErrors.apellidos : undefined} />
            </div>
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

          {/* Tipo + Número cédula */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Tipo <RequiredMark />
              </label>
              <select
                value={cedulaTipo}
                onChange={e => handleCedulaTipoChange(e.target.value as CedulaTipo)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
              >
                {CEDULA_TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.value}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Número de documento <RequiredMark />
              </label>
              <input
                type="text"
                value={cedulaUnica}
                onChange={e => {
                  setCedulaUnica(e.target.value);
                  if (profileTouched.cedulaUnica)
                    setProfileErrors(p => ({ ...p, cedulaUnica: validateProfileField('cedulaUnica', e.target.value) }));
                }}
                onBlur={() => handleProfileBlur('cedulaUnica', cedulaUnica)}
                maxLength={rule.maxLen}
                inputMode={rule.inputMode}
                placeholder={rule.placeholder}
                className={inputCls(profileTouched.cedulaUnica ? profileErrors.cedulaUnica : undefined)}
              />
              <FieldError msg={profileTouched.cedulaUnica ? profileErrors.cedulaUnica : undefined} />
            </div>
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Teléfono <span className="text-slate-500 text-xs font-normal">(opcional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => {
                setPhone(e.target.value);
                if (profileTouched.phone)
                  setProfileErrors(p => ({ ...p, phone: validateProfileField('phone', e.target.value) }));
              }}
              onBlur={() => handleProfileBlur('phone', phone)}
              maxLength={20}
              inputMode="tel"
              placeholder="Ej: 3001234567"
              className={inputCls(profileTouched.phone ? profileErrors.phone : undefined)}
            />
            <FieldError msg={profileTouched.phone ? profileErrors.phone : undefined} />
            {!profileErrors.phone && (
              <p className="text-xs text-slate-500 mt-1">Formato: 3001234567 o +57 300 1234567</p>
            )}
          </div>

          {/* Mensaje resultado */}
          {profileMsg && (
            <div className={`flex items-start gap-3 rounded-xl p-4 text-sm ${
              profileMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {profileMsg.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                : <AlertCircle  className="w-4 h-4 mt-0.5 flex-shrink-0" />}
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

      {/* Cambiar contraseña */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-white">Cambiar Contraseña</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-5" noValidate>

          {/* Nueva contraseña */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Nueva contraseña <RequiredMark />
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => handleNewPasswordChange(e.target.value)}
                onBlur={() => handlePasswordBlur('newPassword', newPassword)}
                maxLength={72}
                placeholder="Mínimo 8 caracteres"
                className={`${inputCls(passwordTouched.newPassword ? passwordErrors.newPassword : undefined)} pr-11`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Barra de fortaleza */}
            {newPassword && pwStrength && (
              <div className="mt-2">
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${pwStrength.color}`} style={{ width: pwStrength.width }} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Fortaleza: <span className={pwStrength.textColor}>{pwStrength.label}</span>
                  <span className="ml-2 text-slate-600">· Usa mayúsculas, números y símbolos</span>
                </p>
              </div>
            )}
            <FieldError msg={passwordTouched.newPassword ? passwordErrors.newPassword : undefined} />
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Confirmar contraseña <RequiredMark />
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => handleConfirmPasswordChange(e.target.value)}
                onBlur={() => handlePasswordBlur('confirmPassword', confirmPassword)}
                maxLength={72}
                placeholder="Repite la contraseña"
                className={`${inputCls(passwordTouched.confirmPassword ? passwordErrors.confirmPassword : undefined)} pr-11`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {confirmPassword && newPassword === confirmPassword && (
                <div className="absolute inset-y-0 right-10 flex items-center pr-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
              )}
            </div>
            <FieldError msg={passwordTouched.confirmPassword ? passwordErrors.confirmPassword : undefined} />
          </div>

          {/* Mensaje resultado */}
          {passwordMsg && (
            <div className={`flex items-start gap-3 rounded-xl p-4 text-sm ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {passwordMsg.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                : <AlertCircle  className="w-4 h-4 mt-0.5 flex-shrink-0" />}
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

      {/* Gestionar categorías */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Tag className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-white">Gestionar Categorías</h2>
        </div>
        <CategoryManager planType={profile?.plan_type ?? 'free'} />
      </div>

      {/* Plan actual */}
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
