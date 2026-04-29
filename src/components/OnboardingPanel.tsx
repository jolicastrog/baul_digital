'use client';

import { useState, useEffect } from 'react';
import {
  X, ChevronDown, ChevronUp, CheckCircle2, Circle,
  Lock, Sparkles, ArrowRight, Upload, Tag, Calendar, Zap,
} from 'lucide-react';
import Link from 'next/link';

const LS_KEY = 'baul_onboarding_v1';

interface OnboardingPanelProps {
  documents: any[];
  quota: any;
  onTriggerUpload: () => void;
}

const FREE_FEATURES = [
  '50 MB de almacenamiento / 15 documentos',
  'Formatos: PDF, Word, Excel, imágenes (JPEG, PNG, WebP)',
  'Alertas de vencimiento en pantalla',
  'Acceso cifrado desde cualquier dispositivo',
];

const PREMIUM_FEATURES = [
  '500 MB de almacenamiento / 200 documentos',
  'Todos los formatos del plan gratuito',
  'Audio (MP3) y video corto (MP4)',
  'Notas de recordatorio por vencimiento',
  'Correos automáticos: 30, 8 y 1 día antes del vencimiento',
  'Hasta 25 categorías personalizadas',
];

const ENTERPRISE_FEATURES = [
  '5 GB de almacenamiento / documentos ilimitados',
  'Todos los formatos: documentos, imágenes, MP3, MP4',
  'Correos automáticos de vencimiento',
  'Panel de administrador',
  'Gestión multi-usuario con roles',
  'Soporte dedicado 24/7',
];

// Lo que el plan actual NO tiene pero el siguiente sí
const LOCKED_FOR_FREE = [
  '500 MB de almacenamiento (200 documentos)',
  'Archivos de audio (MP3) y video (MP4)',
  'Notas de recordatorio personalizadas',
  'Correos automáticos de vencimiento',
];

const LOCKED_FOR_PREMIUM = [
  '5 GB de almacenamiento ilimitado',
  'Panel de administrador',
  'Gestión multi-usuario',
  'Soporte dedicado 24/7',
];

export function OnboardingPanel({ documents, quota, onTriggerUpload }: OnboardingPanelProps) {
  const [dismissed, setDismissed] = useState(true); // true por defecto para evitar flash
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) { setDismissed(false); return; }
      const parsed = JSON.parse(raw);
      setDismissed(!!parsed.dismissed);
      setCollapsed(!!parsed.collapsed);
    } catch {
      setDismissed(false);
    }
  }, []);

  const persist = (d: boolean, c: boolean) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ dismissed: d, collapsed: c })); } catch {}
  };

  const handleDismiss = () => { setDismissed(true); persist(true, collapsed); };
  const handleToggleCollapse = () => { const c = !collapsed; setCollapsed(c); persist(dismissed, c); };

  const planType: string = quota?.plan_type ?? 'free';
  const isPremium    = planType === 'premium';
  const isEnterprise = planType === 'enterprise';
  const isPaid       = isPremium || isEnterprise;

  const steps = [
    {
      id: 'signup',
      Icon: CheckCircle2,
      label: 'Crear tu cuenta',
      done: true,
      action: null as null | { label: string; onClick?: () => void; href?: string },
    },
    {
      id: 'upload',
      Icon: Upload,
      label: 'Subir tu primer documento',
      done: documents.length > 0,
      action: documents.length === 0
        ? { label: 'Subir ahora', onClick: onTriggerUpload }
        : null,
    },
    {
      id: 'category',
      Icon: Tag,
      label: 'Organizar un documento por categoría',
      done: documents.some((d: any) => d.category_id),
      action: null,
    },
    {
      id: 'expiry',
      Icon: Calendar,
      label: 'Asignar una fecha de vencimiento',
      done: documents.some((d: any) => d.expiry_date),
      action: null,
    },
    {
      id: 'plan',
      Icon: Zap,
      label: isPaid ? 'Plan de pago activo ✓' : 'Descubrir los planes Premium',
      done: isPaid,
      action: !isPaid ? { label: 'Ver planes', href: '/dashboard/pricing' } : null,
    },
  ];

  const completed = steps.filter(s => s.done).length;
  const pct        = Math.round((completed / steps.length) * 100);

  const currentFeatures = isEnterprise ? ENTERPRISE_FEATURES : isPremium ? PREMIUM_FEATURES : FREE_FEATURES;
  const lockedFeatures  = isEnterprise ? [] : isPremium ? LOCKED_FOR_PREMIUM : LOCKED_FOR_FREE;
  const upgradePlan     = isPremium ? 'Empresarial' : 'Premium';
  const upgradeColor    = isPremium
    ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border-purple-500/30'
    : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/30';
  const badgeColor = isEnterprise
    ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
    : isPremium
    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
    : 'bg-slate-700 text-slate-300';
  const badgeLabel = isEnterprise ? 'Empresarial' : isPremium ? 'Premium' : 'Gratuito';

  if (dismissed || !quota) return null;

  return (
    <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/70 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">

      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">Primeros pasos en Baúl Digital</p>
            <p className="text-xs text-slate-400">{completed} de {steps.length} pasos completados</p>
          </div>
          {/* Barra de progreso */}
          <div className="hidden sm:flex items-center gap-2 ml-2">
            <div className="w-28 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{pct}%</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleCollapse}
            title={collapsed ? 'Expandir' : 'Minimizar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDismiss}
            title="No mostrar más"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Cuerpo ── */}
      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">

          {/* Columna 1 — Pasos */}
          <div className="p-5 space-y-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
              Explora el sistema
            </p>
            {steps.map(({ id, Icon, label, done, action }) => (
              <div key={id} className="flex items-start gap-3">
                <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                  done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-500'
                }`}>
                  {done
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : <Circle className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${done ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-200'}`}>
                    {label}
                  </p>
                  {action && !done && (
                    action.href
                      ? <Link
                          href={action.href}
                          className="inline-flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        >
                          {action.label} <ArrowRight className="w-3 h-3" />
                        </Link>
                      : <button
                          onClick={action.onClick}
                          className="inline-flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        >
                          {action.label} <ArrowRight className="w-3 h-3" />
                        </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Columna 2 — Bondades del plan */}
          <div className="p-5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
              Tu plan actual
            </p>

            {/* Badge del plan */}
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold mb-3 ${badgeColor}`}>
              {badgeLabel}
            </span>

            {/* Features incluidas */}
            <ul className="space-y-2 mb-4">
              {currentFeatures.map(f => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {/* Features bloqueadas del plan superior */}
            {lockedFeatures.length > 0 && (
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center gap-1.5 mb-3">
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Desbloquea con {upgradePlan}
                  </span>
                </div>
                <ul className="space-y-2 mb-4">
                  {lockedFeatures.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-500">
                      <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard/pricing"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${upgradeColor}`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Conocer {upgradePlan}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}

            {isEnterprise && (
              <div className="pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tienes acceso a todas las funcionalidades del sistema.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
