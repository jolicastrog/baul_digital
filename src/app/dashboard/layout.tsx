"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, FileText, Settings, ShieldCheck, LogOut, CreditCard } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<{ name: string; email: string; plan: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then((data: { profile?: { full_name: string; email: string; plan_type: string } } | null) => {
        if (data?.profile) {
          setSessionUser({
            name: data.profile.full_name || data.profile.email,
            email: data.profile.email,
            plan: data.profile.plan_type,
          });
        }
      });
  }, []);

  const handleLogout = async () => {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      router.push('/login');
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sidebar fijo */}
      <aside className="w-64 flex-shrink-0 border-r border-white/5 bg-slate-900/40 backdrop-blur-xl flex flex-col justify-between">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-10">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Baúl Digital</span>
          </div>

          <nav className="space-y-2">
            <Link href="/dashboard" className="flex items-center px-4 py-3 bg-blue-600/10 text-blue-400 rounded-xl transition-colors font-medium">
              <LayoutDashboard className="w-5 h-5 mr-3" />
              Inicio
            </Link>
            <Link href="/dashboard" className="flex items-center px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-medium">
              <FileText className="w-5 h-5 mr-3" />
              Mis Archivos
            </Link>
            <Link href="/dashboard/pricing" className="flex items-center px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-medium">
              <CreditCard className="w-5 h-5 mr-3" />
              Planes
            </Link>
            <Link href="/dashboard/settings" className="flex items-center px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-medium">
              <Settings className="w-5 h-5 mr-3" />
              Configuración
            </Link>
          </nav>
        </div>

        <div className="p-6 border-t border-white/5">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center uppercase font-bold text-slate-300">
              {sessionUser?.name?.[0] ?? 'U'}
            </div>
            <div className="ml-3 overflow-hidden text-sm">
              <p className="font-semibold text-white truncate">{sessionUser?.name ?? '—'}</p>
              <p className="text-slate-500 truncate capitalize">{sessionUser?.plan ?? ''}</p>
            </div>
          </div>
          <button 
             onClick={handleLogout}
             className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors font-medium">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenedor central principal */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute top-0 right-0 w-1/2 h-64 bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="p-8 max-w-7xl mx-auto relative z-10 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
