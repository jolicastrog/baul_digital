"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, ShieldCheck, Eye, EyeOff, XCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import LegalFooter from '@/components/LegalFooter';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface FormErrors {
  email?:    string;
  password?: string;
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

function inputClass(hasError?: boolean) {
  return `block w-full pl-11 pr-4 py-3 bg-slate-950/50 border rounded-xl text-slate-200
    placeholder-slate-500 focus:outline-none focus:ring-2 transition-all
    ${hasError
      ? 'border-red-500/60 focus:ring-red-500/40'
      : 'border-white/10 focus:ring-blue-500 focus:border-transparent'}`;
}

const ERROR_MESSAGES: Record<string, string> = {
  enlace_invalido:      'El enlace de confirmación no es válido o ya fue usado.',
  confirmacion_fallida: 'No se pudo confirmar el correo. Solicita un nuevo enlace.',
};

const INFO_MESSAGES: Record<string, string> = {
  confirmado:     '¡Correo confirmado! Ya puedes iniciar sesión.',
  verifica_email: '¡Registro exitoso! Revisa tu bandeja de entrada y confirma tu correo electrónico para poder ingresar.',
};

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [errors,   setErrors]   = useState<FormErrors>({});
  const [touched,  setTouched]  = useState({ email: false, password: false });
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [serverError,        setServerError]        = useState('');
  const [infoMsg,            setInfoMsg]            = useState('');
  const [verifyEmailMode,    setVerifyEmailMode]    = useState(false);
  const [emailNotConfirmed,  setEmailNotConfirmed]  = useState(false);
  const [resendLoading,      setResendLoading]      = useState(false);
  const [resendMsg,          setResendMsg]          = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err && ERROR_MESSAGES[err]) setServerError(ERROR_MESSAGES[err]);
    const msg = searchParams.get('msg');
    if (msg && INFO_MESSAGES[msg]) setInfoMsg(INFO_MESSAGES[msg]);
    if (msg === 'verifica_email') setVerifyEmailMode(true);
    // Pre-llenar email cuando viene del registro
    const emailParam = searchParams.get('email');
    if (emailParam) setEmail(decodeURIComponent(emailParam));
  }, [searchParams]);

  const validateEmail = (val: string): string | undefined => {
    if (!val.trim())                     return 'El correo es obligatorio.';
    if (!emailRegex.test(val.trim()))    return 'Ingresa un correo electrónico válido.';
    if (val.length > 254)                return 'El correo no puede superar 254 caracteres.';
  };

  const validatePassword = (val: string): string | undefined => {
    if (!val)              return 'La contraseña es obligatoria.';
    if (val.length < 6)    return 'Mínimo 6 caracteres.';
    if (val.length > 72)   return 'Máximo 72 caracteres.';
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (touched.email) setErrors(p => ({ ...p, email: validateEmail(val) }));
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (touched.password) setErrors(p => ({ ...p, password: validatePassword(val) }));
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(p => ({ ...p, [field]: true }));
    if (field === 'email')    setErrors(p => ({ ...p, email:    validateEmail(email) }));
    if (field === 'password') setErrors(p => ({ ...p, password: validatePassword(password) }));
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendMsg(null);
    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
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
    setEmailNotConfirmed(false);
    setResendMsg(null);

    const emailErr    = validateEmail(email);
    const passwordErr = validatePassword(password);
    setTouched({ email: true, password: true });
    setErrors({ email: emailErr, password: passwordErr });
    if (emailErr || passwordErr) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'email_not_confirmed') {
          setEmailNotConfirmed(true);
        }
        throw new Error(data.error || 'Credenciales incorrectas. Verifica tu correo y contraseña.');
      }
      const redirectTo = searchParams.get('redirectTo');
      router.push(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard');
      router.refresh();
    } catch (err: any) {
      setServerError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center relative overflow-hidden text-slate-200">
      <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-blue-900/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full mx-auto p-6 sm:p-8 relative z-10">
        {/* Cabecera */}
        <div className="mb-8 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Bienvenido de nuevo</h1>
          <p className="text-slate-400">Ingresa a tu Baúl Digital donde tus documentos están seguros.</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 sm:p-8 rounded-3xl shadow-2xl">
          {/* Registro exitoso — bloque con guía de confirmación */}
          {verifyEmailMode && (
            <div className="mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">
                  ¡Registro exitoso! Revisa tu bandeja de entrada y confirma tu correo para ingresar.
                </p>
              </div>
              <ul className="text-xs text-emerald-300/80 space-y-1.5 pl-6 list-disc leading-relaxed">
                <li>Revisa también la carpeta de <span className="font-medium text-emerald-300">spam o correo no deseado</span>.</li>
                <li>Si en <span className="font-medium text-emerald-300">5 minutos</span> no llega, usa el botón de abajo para reenviar el enlace.</li>
                <li>Si definitivamente no llega, espera <span className="font-medium text-emerald-300">24 horas</span> e intenta registrarte con un <span className="font-medium text-emerald-300">correo diferente</span>.</li>
              </ul>
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
                  disabled={resendLoading || !email}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resendLoading ? 'animate-spin' : ''}`} />
                  {resendLoading ? 'Enviando...' : 'Reenviar enlace de confirmación'}
                </button>
              )}
            </div>
          )}

          {/* Mensaje simple (ej. correo ya confirmado) */}
          {infoMsg && !verifyEmailMode && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {infoMsg}
            </div>
          )}

          {/* Error del servidor */}
          {serverError && (
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {serverError}
            </div>
          )}

          {/* Reenviar confirmación */}
          {emailNotConfirmed && (
            <div className="mb-6 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
              <p className="text-xs text-amber-300">
                ¿No encuentras el correo de confirmación? Revisa también la carpeta de spam.
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
                  disabled={resendLoading || !email}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resendLoading ? 'animate-spin' : ''}`} />
                  {resendLoading ? 'Enviando...' : 'Reenviar enlace de confirmación'}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Correo Electrónico <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => handleEmailChange(e.target.value)}
                  onBlur={() => handleBlur('email')}
                  maxLength={254}
                  className={inputClass(touched.email && !!errors.email)}
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
              <FieldError msg={touched.email ? errors.email : undefined} />
            </div>

            {/* Contraseña */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Contraseña <span className="text-red-400">*</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  tabIndex={-1}
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => handlePasswordChange(e.target.value)}
                  onBlur={() => handleBlur('password')}
                  maxLength={72}
                  className={`${inputClass(touched.password && !!errors.password)} pr-11`}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
              <FieldError msg={touched.password ? errors.password : undefined} />
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Iniciando sesión...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
            Crea una ahora
          </Link>
        </p>
      </div>
      <LegalFooter />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
