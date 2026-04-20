"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck, XCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import LegalFooter from '@/components/LegalFooter';

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (!password) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (password.length >= 8)           score++;
  if (password.length >= 12)          score++;
  if (/[A-Z]/.test(password))         score++;
  if (/[0-9]/.test(password))         score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return { label: 'Débil',  color: 'bg-red-500',    width: '33%'  };
  if (score <= 3) return { label: 'Media',  color: 'bg-yellow-500', width: '66%'  };
  return             { label: 'Fuerte', color: 'bg-emerald-500', width: '100%' };
}

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword]  = useState('');
  const [confirm,  setConfirm]   = useState('');
  const [showPass, setShowPass]  = useState(false);
  const [loading,  setLoading]   = useState(false);
  const [error,    setError]     = useState('');
  const [success,  setSuccess]   = useState(false);

  const strength      = getPasswordStrength(password);
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      // Usar cliente browser — la sesión ya está activa desde /auth/confirm
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        console.error('[reset-password]', updateError.message);
        setError('No se pudo actualizar la contraseña. El enlace puede haber expirado.');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2500);
    } catch (err: any) {
      setError(err.message ?? 'Error interno.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center relative overflow-hidden text-slate-200">
      <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-blue-900/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full mx-auto p-6 sm:p-8 relative z-10">
        <div className="mb-8 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Nueva contraseña</h1>
          <p className="text-slate-400">Elige una contraseña segura para tu cuenta.</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 sm:p-8 rounded-3xl shadow-2xl">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
              <p className="text-white font-semibold text-lg">¡Contraseña actualizada!</p>
              <p className="text-slate-400 text-sm">Redirigiendo a tu dashboard…</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>

                {/* Nueva contraseña */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Nueva contraseña <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      maxLength={72}
                      className="block w-full pl-11 pr-11 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      required
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
                  {password && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                          style={{ width: strength.width }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Fortaleza:{' '}
                        <span className={
                          strength.label === 'Fuerte' ? 'text-emerald-400' :
                          strength.label === 'Media'  ? 'text-yellow-400'  : 'text-red-400'
                        }>{strength.label}</span>
                        <span className="ml-2 text-slate-600">· Usa mayúsculas, números y símbolos</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirmar contraseña */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Confirmar contraseña <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      maxLength={72}
                      className={`block w-full pl-11 pr-11 py-3 bg-slate-950/50 border rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all
                        ${passwordsMismatch
                          ? 'border-red-500/60 focus:ring-red-500/40'
                          : passwordsMatch
                            ? 'border-emerald-500/60 focus:ring-emerald-500/40'
                            : 'border-white/10 focus:ring-blue-500 focus:border-transparent'}`}
                      placeholder="Repite la contraseña"
                      autoComplete="new-password"
                      required
                    />
                    {confirm.length > 0 && (
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        {passwordsMatch
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          : <XCircle className="w-4 h-4 text-red-400" />}
                      </div>
                    )}
                  </div>
                  {passwordsMismatch && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      Las contraseñas no coinciden.
                    </p>
                  )}
                  {passwordsMatch && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      Las contraseñas coinciden.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
