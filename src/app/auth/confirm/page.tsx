'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { ShieldCheck } from 'lucide-react';

function AuthConfirmHandler() {
  const router      = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function handleConfirm() {
      const code       = searchParams.get('code');
      const token_hash = searchParams.get('token_hash');
      const type       = searchParams.get('type');

      // Flujo implícito: tokens en el fragmento #access_token=...
      const hash        = window.location.hash.substring(1);
      const hashParams  = new URLSearchParams(hash);
      const accessToken  = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const hashType     = hashParams.get('type');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          router.replace('/login?error=confirmacion_fallida');
          return;
        }
        if (hashType === 'recovery' || type === 'recovery') {
          router.replace('/reset-password');
          return;
        }
        router.replace('/login?msg=confirmado');
        return;
      }

      // Flujo PKCE: ?code=xxx
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace('/login?error=confirmacion_fallida');
          return;
        }
        router.replace(type === 'recovery' ? '/reset-password' : '/login?msg=confirmado');
        return;
      }

      // Flujo OTP: ?token_hash=xxx&type=xxx
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
        });
        if (error) {
          router.replace('/login?error=confirmacion_fallida');
          return;
        }
        router.replace(type === 'recovery' ? '/reset-password' : '/login?msg=confirmado');
        return;
      }

      router.replace('/login?error=enlace_invalido');
    }

    handleConfirm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-200">
      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
        <ShieldCheck className="w-8 h-8 text-white" />
      </div>
      <p className="text-slate-400 animate-pulse">Verificando enlace…</p>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense>
      <AuthConfirmHandler />
    </Suspense>
  );
}
