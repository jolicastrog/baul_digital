"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, ShieldCheck, Eye, EyeOff, XCircle } from 'lucide-react';

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

export default function LoginPage() {
  const router = useRouter();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [errors,   setErrors]   = useState<FormErrors>({});
  const [touched,  setTouched]  = useState({ email: false, password: false });
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [serverError, setServerError] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

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
      if (!res.ok) throw new Error(data.error || 'Credenciales incorrectas. Verifica tu correo y contraseña.');
      router.push('/dashboard');
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
          {/* Error del servidor */}
          {serverError && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {serverError}
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
                  href="#"
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
    </div>
  );
}
