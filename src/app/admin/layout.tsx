"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, CreditCard, FileText, FolderOpen,
  Receipt, ClipboardList, ShieldAlert, LogOut, Menu, X, ShieldCheck,
} from 'lucide-react';

const NAV_LINKS = [
  { href: '/admin',                 icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/users',           icon: Users,           label: 'Usuarios' },
  { href: '/admin/plans',           icon: CreditCard,      label: 'Planes' },
  { href: '/admin/document-types',  icon: FileText,        label: 'Tipos de Documento' },
  { href: '/admin/categories',      icon: FolderOpen,      label: 'Categorías Template' },
  { href: '/admin/payments',        icon: Receipt,         label: 'Pagos' },
  { href: '/admin/audit',           icon: ClipboardList,   label: 'Auditoría' },
  { href: '/admin/fraud',           icon: ShieldAlert,     label: 'Fraude' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [adminName, setAdminName] = useState('Admin');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then((d: { profile?: { full_name: string } } | null) => {
        if (d?.profile?.full_name) setAdminName(d.profile.full_name);
      });
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const handleLogout = async () => {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) router.push('/login');
  };

  const SidebarContent = () => (
    <>
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white block leading-tight">Baúl Digital</span>
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-widest">Admin</span>
          </div>
        </div>

        <div className="my-5 border-t border-white/5" />

        <nav className="space-y-1">
          {NAV_LINKS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center px-4 py-2.5 rounded-xl transition-colors font-medium text-sm ${
                  isActive
                    ? 'bg-purple-600/15 text-purple-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 mr-3 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-6 border-t border-white/5">
        <div className="flex items-center mb-4">
          <div className="w-9 h-9 bg-purple-900/50 rounded-full flex items-center justify-center uppercase font-bold text-purple-300 text-sm flex-shrink-0">
            {adminName[0]}
          </div>
          <div className="ml-3 overflow-hidden text-sm">
            <p className="font-semibold text-white truncate">{adminName}</p>
            <p className="text-purple-400 text-xs font-medium">Administrador</p>
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
      <aside className="hidden md:flex w-64 flex-shrink-0 border-r border-white/5 bg-slate-900/40 backdrop-blur-xl flex-col justify-between">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed top-0 left-0 h-full w-72 z-50 bg-slate-900 border-r border-white/5 flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-slate-900/40 backdrop-blur-xl flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Admin Panel</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="absolute top-0 right-0 w-1/2 h-64 bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="p-4 md:p-8 max-w-7xl mx-auto relative z-10 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
