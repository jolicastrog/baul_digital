"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, ShieldCheck, User, Fingerprint, Eye, EyeOff, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import LegalFooter from '@/components/LegalFooter';

// ── Tipos ──────────────────────────────────────────────────────────────────
type CedulaTipo = string;

interface DocumentType {
  code:          string;
  name:          string;
  min_age_years: number | null;
}

interface FormData {
  email:           string;
  password:        string;
  confirmPassword: string;
  nombres:         string;
  apellidos:       string;
  cedulaUnica:     string;
  cedulaTipo:      CedulaTipo;
}

interface FormErrors {
  email?:           string;
  password?:        string;
  confirmPassword?: string;
  nombres?:         string;
  apellidos?:       string;
  cedulaUnica?:     string;
  acceptTerms?:     string;
}

// ── Validaciones por tipo de documento ─────────────────────────────────────
const CEDULA_RULES: Record<string, { pattern: RegExp; msg: string; placeholder: string; maxLen: number; inputMode: 'numeric' | 'text' }> = {
  CC:  { pattern: /^[A-Za-z0-9]{3,10}$/,   msg: 'Mínimo 3 caracteres, máximo 10', placeholder: 'Ej. 79790374',    maxLen: 10, inputMode: 'numeric' },
  TI:  { pattern: /^[A-Za-z0-9]{3,10}$/,   msg: 'Mínimo 3 caracteres, máximo 10', placeholder: 'Ej. 1020304050',  maxLen: 10, inputMode: 'numeric' },
  CE:  { pattern: /^[A-Za-z0-9\-]{3,15}$/, msg: 'Mínimo 3 caracteres, máximo 15', placeholder: 'Ej. COL-2145',    maxLen: 15, inputMode: 'text'    },
  PA:  { pattern: /^[A-Za-z0-9\-]{3,20}$/, msg: 'Mínimo 3 caracteres, máximo 20', placeholder: 'Ej. AB-123456',   maxLen: 20, inputMode: 'text'    },
  NIT: { pattern: /^[A-Za-z0-9]{3,11}$/,   msg: 'Mínimo 3 caracteres, máximo 11', placeholder: 'Ej. 9001234567',  maxLen: 11, inputMode: 'numeric' },
  PEP: { pattern: /^[A-Za-z0-9\-]{3,20}$/, msg: 'Mínimo 3 caracteres, máximo 20', placeholder: 'Ej. PEP-1234567', maxLen: 20, inputMode: 'text'    },
  PPT: { pattern: /^[A-Za-z0-9\-]{3,20}$/, msg: 'Mínimo 3 caracteres, máximo 20', placeholder: 'Ej. PPT-1234567', maxLen: 20, inputMode: 'text'    },
};
const DEFAULT_RULE = { pattern: /^[A-Za-z0-9\-]{3,20}$/, msg: 'Mínimo 3 caracteres, máximo 20', placeholder: 'Número de documento', maxLen: 20, inputMode: 'text' as const };

// ── Helpers ────────────────────────────────────────────────────────────────
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateForm(data: FormData): FormErrors {
  const errors: FormErrors = {};

  // Nombres
  if (!data.nombres.trim()) {
    errors.nombres = 'Los nombres son obligatorios.';
  } else if (!/^[A-Za-záéíóúÁÉÍÓÚüÜñÑ\s]{2,60}$/.test(data.nombres.trim())) {
    errors.nombres = 'Solo letras y espacios, entre 2 y 60 caracteres.';
  }

  // Apellidos
  if (!data.apellidos.trim()) {
    errors.apellidos = 'Los apellidos son obligatorios.';
  } else if (!/^[A-Za-záéíóúÁÉÍÓÚüÜñÑ\s]{2,60}$/.test(data.apellidos.trim())) {
    errors.apellidos = 'Solo letras y espacios, entre 2 y 60 caracteres.';
  }

  // Número de documento
  const rule = CEDULA_RULES[data.cedulaTipo] ?? DEFAULT_RULE;
  if (!data.cedulaUnica.trim()) {
    errors.cedulaUnica = 'El número de documento es obligatorio.';
  } else if (!rule.pattern.test(data.cedulaUnica.trim())) {
    errors.cedulaUnica = rule.msg;
  }

  // Email
  if (!data.email.trim()) {
    errors.email = 'El correo electrónico es obligatorio.';
  } else if (!emailRegex.test(data.email.trim())) {
    errors.email = 'Ingresa un correo electrónico válido.';
  } else if (data.email.length > 254) {
    errors.email = 'El correo no puede superar 254 caracteres.';
  }

  // Contraseña
  if (!data.password) {
    errors.password = 'La contraseña es obligatoria.';
  } else if (data.password.length < 8) {
    errors.password = 'Mínimo 8 caracteres.';
  } else if (data.password.length > 72) {
    errors.password = 'Máximo 72 caracteres.';
  } else if (!/[A-Z]/.test(data.password)) {
    errors.password = 'Debe incluir al menos una letra mayúscula.';
  } else if (!/[0-9]/.test(data.password)) {
    errors.password = 'Debe incluir al menos un número.';
  }

  // Confirmar contraseña
  if (!data.confirmPassword) {
    errors.confirmPassword = 'Confirma tu contraseña.';
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }

  return errors;
}

function validateAcceptTerms(accepted: boolean): string {
  return accepted ? '' : 'Debes aceptar la Política de Privacidad y los Términos de Uso para continuar.';
}

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (!password) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (password.length >= 8)            score++;
  if (password.length >= 12)           score++;
  if (/[A-Z]/.test(password))          score++;
  if (/[0-9]/.test(password))          score++;
  if (/[^A-Za-z0-9]/.test(password))  score++;
  if (score <= 2) return { label: 'Débil',   color: 'bg-red-500',    width: '33%' };
  if (score <= 3) return { label: 'Media',   color: 'bg-yellow-500', width: '66%' };
  return              { label: 'Fuerte',  color: 'bg-emerald-500', width: '100%' };
}

// ── Componentes de apoyo ───────────────────────────────────────────────────
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

function inputClass(error?: string) {
  return `block w-full pl-11 pr-4 py-3 bg-slate-950/50 border rounded-xl text-slate-200 placeholder-slate-500
    focus:outline-none focus:ring-2 transition-all
    ${error
      ? 'border-red-500/60 focus:ring-red-500/40'
      : 'border-white/10 focus:ring-blue-500'}`;
}

// ── Página principal ───────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    email:           '',
    password:        '',
    confirmPassword: '',
    nombres:         '',
    apellidos:       '',
    cedulaUnica:     '',
    cedulaTipo:      'CC',
  });

  const [errors, setErrors]             = useState<FormErrors>({});
  const [touched, setTouched]           = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [loading, setLoading]                 = useState(false);
  const [serverError, setServerError]         = useState('');
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false);
  const [resendLoading, setResendLoading]     = useState(false);
  const [resendMsg, setResendMsg]             = useState<{ text: string; ok: boolean } | null>(null);
  const [showPass, setShowPass]         = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [acceptTerms, setAcceptTerms]   = useState(false);
  const [termsError, setTermsError]     = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState('');
  const turnstileRef                    = useRef<TurnstileInstance>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);

  useEffect(() => {
    fetch('/api/document-types')
      .then(r => r.json())
      .then(d => { if (d.types) setDocumentTypes(d.types); })
      .catch(() => {});
  }, []);

  const passwordStrength = getPasswordStrength(formData.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    // Revalidar campo tocado en tiempo real
    if (touched[name as keyof FormData]) {
      const newErrors = validateForm(updated);
      setErrors(prev => ({ ...prev, [name]: newErrors[name as keyof FormErrors] }));
    }
    // Si cambia tipo de documento, limpiar el número
    if (name === 'cedulaTipo') {
      setFormData({ ...updated, cedulaUnica: '' });
      setErrors(prev => ({ ...prev, cedulaUnica: undefined }));
      setTouched(prev => ({ ...prev, cedulaUnica: false }));
    }
  };

  const handleBlur = (field: keyof FormData) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const newErrors = validateForm(formData);
    setErrors(prev => ({ ...prev, [field]: newErrors[field as keyof FormErrors] }));
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendMsg(null);
    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: formData.email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResendMsg({ text: data.error || 'No se pudo reenviar. Intenta de nuevo.', ok: false });
      } else {
        setResendMsg({ text: '¡Enlace reenviado! Revisa tu bandeja de entrada (y la carpeta de spam).', ok: true });
      }
    } catch {
      setResendMsg({ text: 'Error de conexión. Intenta de nuevo.', ok: false });
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    setEmailUnconfirmed(false);
    setResendMsg(null);

    // Marcar todos como tocados y validar
    const allTouched = Object.keys(formData).reduce(
      (acc, k) => ({ ...acc, [k]: true }),
      {} as Record<keyof FormData, boolean>
    );
    setTouched(allTouched);

    const allErrors = validateForm(formData);
    setErrors(allErrors);
    const termsErr = validateAcceptTerms(acceptTerms);
    setTermsError(termsErr);
    const captchaErr = captchaToken ? '' : 'Completa la verificación de seguridad.';
    setCaptchaError(captchaErr);
    if (Object.keys(allErrors).length > 0 || termsErr || captchaErr) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:         formData.email.trim(),
          password:      formData.password,
          nombres:       formData.nombres.trim(),
          apellidos:     formData.apellidos.trim(),
          cedulaUnica:   formData.cedulaUnica.trim(),
          cedulaTipo:    formData.cedulaTipo,
          acceptedTerms: true,
          captchaToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'email_unconfirmed') {
          setEmailUnconfirmed(true);
        }
        throw new Error(data.error || 'Error al procesar el registro');
      }
      // hasSession=true → confirmación desactivada, usuario ya autenticado → ir al dashboard
      // hasSession=false → confirmación activa → debe verificar email primero
      if (data.hasSession) {
        router.push('/dashboard');
        router.refresh();
      } else {
        router.push('/login?msg=verifica_email');
      }
    } catch (err: any) {
      setServerError(err.message);
      setLoading(false);
      // Resetear captcha para que el usuario pueda intentar de nuevo
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  const rule = CEDULA_RULES[formData.cedulaTipo] ?? DEFAULT_RULE;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center relative overflow-hidden text-slate-200 py-12">
      <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-blue-900/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-xl w-full mx-auto p-4 sm:p-8 relative z-10">
        {/* Cabecera */}
        <div className="mb-8 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Crea tu Baúl</h1>
          <p className="text-slate-400">Protege tu documentación importante unificándola en un solo lugar.</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 sm:p-8 rounded-3xl shadow-2xl">
          {/* Error del servidor */}
          {serverError && !emailUnconfirmed && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {serverError}
            </div>
          )}

          {/* Email registrado pero sin confirmar */}
          {emailUnconfirmed && (
            <div className="mb-6 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
                <p className="text-sm font-medium text-amber-300">{serverError}</p>
              </div>
              <p className="text-xs text-amber-300/80">
                ¿No encuentras el correo de confirmación? Revisa la carpeta de spam o reenvía el enlace.
              </p>
              {resendMsg ? (
                <p className={`text-xs font-medium flex items-center gap-1.5 ${resendMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {resendMsg.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                  {resendMsg.text}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resendLoading ? 'animate-spin' : ''}`} />
                  {resendLoading ? 'Enviando...' : 'Reenviar enlace de confirmación'}
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500 mb-5">
            Los campos marcados con <span className="text-red-400">*</span> son obligatorios.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Nombres + Apellidos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nombres <RequiredMark />
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    name="nombres"
                    value={formData.nombres}
                    onChange={handleChange}
                    onBlur={() => handleBlur('nombres')}
                    maxLength={60}
                    className={inputClass(touched.nombres ? errors.nombres : undefined)}
                    placeholder="Ej. Juan Carlos"
                    autoComplete="given-name"
                  />
                </div>
                <FieldError msg={touched.nombres ? errors.nombres : undefined} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Apellidos <RequiredMark />
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    name="apellidos"
                    value={formData.apellidos}
                    onChange={handleChange}
                    onBlur={() => handleBlur('apellidos')}
                    maxLength={60}
                    className={inputClass(touched.apellidos ? errors.apellidos : undefined)}
                    placeholder="Ej. Pérez Gómez"
                    autoComplete="family-name"
                  />
                </div>
                <FieldError msg={touched.apellidos ? errors.apellidos : undefined} />
              </div>
            </div>

            {/* Tipo + Número de documento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Tipo de Documento <RequiredMark />
                </label>
                <select
                  name="cedulaTipo"
                  value={formData.cedulaTipo}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                >
                  {documentTypes.length > 0
                    ? documentTypes.map(dt => (
                        <option key={dt.code} value={dt.code}>
                          {dt.code} – {dt.name}
                        </option>
                      ))
                    : (
                      // Fallback mientras carga (sin RC)
                      <>
                        <option value="CC">CC – Cédula de Ciudadanía</option>
                        <option value="TI">TI – Tarjeta de Identidad</option>
                        <option value="CE">CE – Cédula de Extranjería</option>
                        <option value="PA">PA – Pasaporte</option>
                        <option value="NIT">NIT – NIT Empresarial</option>
                        <option value="PEP">PEP – Perm. Especial de Permanencia</option>
                        <option value="PPT">PPT – Perm. de Protección Temporal</option>
                      </>
                    )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Número de Documento <RequiredMark />
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Fingerprint className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    name="cedulaUnica"
                    value={formData.cedulaUnica}
                    onChange={handleChange}
                    onBlur={() => handleBlur('cedulaUnica')}
                    maxLength={rule.maxLen}
                    className={inputClass(touched.cedulaUnica ? errors.cedulaUnica : undefined)}
                    placeholder={rule.placeholder}
                    inputMode={rule.inputMode}
                  />
                </div>
                <FieldError msg={touched.cedulaUnica ? errors.cedulaUnica : undefined} />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Correo Electrónico <RequiredMark />
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur('email')}
                  maxLength={254}
                  className={inputClass(touched.email ? errors.email : undefined)}
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
              <FieldError msg={touched.email ? errors.email : undefined} />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Contraseña <RequiredMark />
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => handleBlur('password')}
                  maxLength={72}
                  className={`${inputClass(touched.password ? errors.password : undefined)} pr-11`}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Barra de fortaleza */}
              {formData.password && (
                <div className="mt-2">
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: passwordStrength.width }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Fortaleza: <span className={
                      passwordStrength.label === 'Fuerte' ? 'text-emerald-400' :
                      passwordStrength.label === 'Media'  ? 'text-yellow-400' : 'text-red-400'
                    }>{passwordStrength.label}</span>
                    <span className="ml-2 text-slate-600">· Usa mayúsculas, números y símbolos para mejorarla</span>
                  </p>
                </div>
              )}
              <FieldError msg={touched.password ? errors.password : undefined} />
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Confirmar Contraseña <RequiredMark />
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={() => handleBlur('confirmPassword')}
                  maxLength={72}
                  className={`${inputClass(touched.confirmPassword ? errors.confirmPassword : undefined)} pr-11`}
                  placeholder="Repite tu contraseña"
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
                {/* Check verde si coinciden */}
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <div className="absolute inset-y-0 right-10 flex items-center pr-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
              </div>
              <FieldError msg={touched.confirmPassword ? errors.confirmPassword : undefined} />
            </div>

            {/* Autorización de datos personales — Ley 1581/2012 */}
            <div className="space-y-1">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={e => {
                    setAcceptTerms(e.target.checked);
                    if (termsError) setTermsError(validateAcceptTerms(e.target.checked));
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 flex-shrink-0 cursor-pointer"
                />
                <span className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                  He leído y acepto la{' '}
                  <Link href="/privacidad" target="_blank" className="text-blue-400 hover:text-blue-300 underline font-medium">
                    Política de Privacidad y Tratamiento de Datos Personales
                  </Link>{' '}
                  y los{' '}
                  <Link href="/terminos" target="_blank" className="text-blue-400 hover:text-blue-300 underline font-medium">
                    Términos y Condiciones
                  </Link>
                  . Autorizo el tratamiento de mis datos conforme a la Ley 1581 de 2012.
                  <RequiredMark />
                </span>
              </label>
              {termsError && (
                <p className="flex items-center gap-1 text-xs text-red-400 pl-7">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {termsError}
                </p>
              )}
            </div>

            {/* Verificación CAPTCHA — Cloudflare Turnstile */}
            <div className="space-y-1">
              <Turnstile
                ref={turnstileRef}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                onSuccess={token => { setCaptchaToken(token); setCaptchaError(''); }}
                onExpire={() => { setCaptchaToken(null); }}
                onError={() => { setCaptchaToken(null); setCaptchaError('Error en la verificación. Intenta de nuevo.'); }}
                options={{ theme: 'dark', language: 'es' }}
              />
              {captchaError && (
                <p className="flex items-center gap-1 text-xs text-red-400">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {captchaError}
                </p>
              )}
            </div>

            {/* Botón enviar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Registrando cuenta...' : 'Crear Cuenta'}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
            Inicia sesión
          </Link>
        </p>
      </div>
      <LegalFooter />
    </div>
  );
}
