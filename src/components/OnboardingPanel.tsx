'use client';

import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, CheckCircle2, Circle, Sparkles, ArrowRight, BookOpen } from 'lucide-react';
import Link from 'next/link';

const LS_KEY = 'baul_onboarding_v2';

interface OnboardingPanelProps {
  documents: any[];
  quota: any;
  onTriggerUpload: () => void;
}

export function OnboardingPanel({ documents, quota, onTriggerUpload }: OnboardingPanelProps) {
  const [dismissed, setDismissed] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) { setDismissed(false); return; }
      const p = JSON.parse(raw);
      setDismissed(!!p.dismissed);
      setCollapsed(!!p.collapsed);
    } catch { setDismissed(false); }
  }, []);

  const persist = (d: boolean, c: boolean) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ dismissed: d, collapsed: c })); } catch {}
  };

  const handleDismiss  = () => { setDismissed(true);  persist(true, collapsed); };
  const handleCollapse = () => { const c = !collapsed; setCollapsed(c); persist(dismissed, c); };

  const planType  = quota?.plan_type ?? 'free';
  const isPaid    = planType === 'premium' || planType === 'enterprise';

  const steps = [
    { id: 'signup',   label: 'Crear tu cuenta',                      done: true,                                      action: null as null | { label: string; onClick?: () => void; href?: string } },
    { id: 'upload',   label: 'Subir tu primer documento',             done: documents.length > 0,                      action: documents.length === 0 ? { label: 'Subir ahora', onClick: onTriggerUpload } : null },
    { id: 'category', label: 'Organizar un documento por categoría',  done: documents.some((d: any) => d.category_id), action: null },
    { id: 'expiry',   label: 'Asignar una fecha de vencimiento',      done: documents.some((d: any) => d.expiry_date), action: null },
    { id: 'plan',     label: isPaid ? 'Plan de pago activo ✓' : 'Descubrir los planes Premium', done: isPaid,         action: !isPaid ? { label: 'Ver planes', href: '/dashboard/pricing' } : null },
  ];

  const completed = steps.filter(s => s.done).length;
  const pct       = Math.round((completed / steps.length) * 100);

  if (dismissed || !quota) return null;

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">

      {/* Cabecera */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">Primeros pasos</p>
            <p className="text-xs text-slate-400">{completed} de {steps.length} completados</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 ml-1">
            <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{pct}%</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/dashboard/guide"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors border border-white/5 mr-1">
            <BookOpen className="w-3.5 h-3.5" />
            Ver guía completa
          </Link>
          <button onClick={handleCollapse} title={collapsed ? 'Expandir' : 'Minimizar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button onClick={handleDismiss} title="No mostrar más"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Checklist */}
      {!collapsed && (
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {steps.map(({ id, label, done, action }) => (
            <div key={id} className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors ${
              done ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-slate-800/40 border-white/5'
            }`}>
              <div className={`mt-0.5 flex-shrink-0 w-4.5 h-4.5 ${done ? 'text-emerald-400' : 'text-slate-500'}`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs leading-snug ${done ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-300'}`}>
                  {label}
                </p>
                {action && !done && (
                  action.href
                    ? <Link href={action.href}
                        className="inline-flex items-center gap-1 mt-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        {action.label} <ArrowRight className="w-2.5 h-2.5" />
                      </Link>
                    : <button onClick={action.onClick}
                        className="inline-flex items-center gap-1 mt-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        {action.label} <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
