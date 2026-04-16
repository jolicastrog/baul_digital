"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Settings, ShieldCheck, LogOut, CreditCard, Menu, X } from 'lucide-react';
import LegalFooter from '@/components/LegalFooter';

const NAV_LINKS = [
  { href: '/dashboard',          icon: LayoutDashboard, label: 'Inicio' },
  { href: '/dashboard',          icon: FileText,         label: 'Mis Archivos' },
  { href: '/dashboard/pricing',  icon: CreditCard,       label: 'Planes' },
  { href: '/dashboard/settings', icon: Settings,         label: 'Configuración' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [sessionUser, setSessionUser] = useState<{ name: string; email: string; plan: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Cerrar sidebar al cambiar de ruta en móvil
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) router.push('/login');
  };

  const SidebarContent = () => (
    <>
      <div className="p-6">
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Baúl Digital</span>
        </div>

        {/* Navegación */}
        <nav className="space-y-2">
          {NAV_LINKS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={label}
                href={href}
                className={`flex items-center px-4 py-3 rounded-xl transition-colors font-medium ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Usuario + Logout */}
      <div className="p-6 border-t border-white/5">
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center uppercase font-bold text-slate-300 flex-shrink-0">
            {sessionUser?.name?.[0] ?? 'U'}
          </div>
          <div className="ml-3 overflow-hidden text-sm">
            <p className="font-semibold text-white truncate">{sessionUser?.name ?? '—'}</p>
            <p className="text-slate-500 truncate capitalize">{sessionUser?.plan ?? ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors font-medium"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar Sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">

      {/* ── SIDEBAR DESKTOP (siempre visible en md+) ── */}
      <aside className="hidden md:flex w-64 flex-shrink-0 border-r border-white/5 bg-slate-900/40 backdrop-blur-xl flex-col justify-between">
        <SidebarContent />
      </aside>

      {/* ── OVERLAY MÓVIL (fondo oscuro al abrir sidebar) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR MÓVIL (drawer desde la izquierda) ── */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 z-50
        bg-slate-900 border-r border-white/5
        flex flex-col justify-between
        transform transition-transform duration-300 ease-in-out
        md:hidden
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Botón cerrar */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar móvil con botón hamburguesa */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-slate-900/40 backdrop-blur-xl flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Baúl Digital</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative">
          <div className="absolute top-0 right-0 w-1/2 h-64 bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
          <div className="p-4 md:p-8 max-w-7xl mx-auto relative z-10 w-full">
            {children}
          </div>
          <LegalFooter />
        </main>
      </div>
    </div>
  );
}
