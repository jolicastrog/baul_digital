'use client';

import { useState, useEffect } from 'react';
import {
  X, ChevronDown, ChevronUp, CheckCircle2, Circle,
  Lock, Sparkles, ArrowRight, Upload, Calendar,
  Zap, Eye, ShieldCheck, FolderOpen, Bell, Info,
} from 'lucide-react';
import Link from 'next/link';

const LS_KEY = 'baul_onboarding_v2';
type Tab = 'guide' | 'steps' | 'plan';

interface OnboardingPanelProps {
  documents: any[];
  quota: any;
  onTriggerUpload: () => void;
}

// ── Contenido de la guía ────────────────────────────────────────────────────

const GUIDE_SECTIONS = [
  {
    id: 'upload',
    Icon: Upload,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    title: 'Subir documentos',
    points: [
      'Haz clic en "Subir Documento" o arrastra el archivo al área punteada.',
      'Formatos soportados: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), imágenes (JPEG, PNG, WebP).',
      'Las imágenes se comprimen automáticamente — sin pérdida visible de calidad.',
      'Asigna una categoría y/o fecha de vencimiento al momento de subir.',
    ],
    premiumNote: 'Premium / Empresarial: también admite archivos MP3 y MP4 (audio y video corto).',
  },
  {
    id: 'categories',
    Icon: FolderOpen,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'Categorías',
    points: [
      'Agrupa tus documentos: Cédula, SOAT, Contratos, Diplomas, Facturas, etc.',
      'Selecciona la categoría al subir el archivo o muévelo después con el ícono de carpeta.',
      'Filtra tu bóveda por categoría usando el menú lateral izquierdo.',
      'El plan Gratuito incluye 6 categorías por defecto.',
    ],
    premiumNote: 'Premium: crea hasta 25 categorías personalizadas. Empresarial: ilimitadas.',
  },
  {
    id: 'expiry',
    Icon: Calendar,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
    title: 'Fechas de vencimiento',
    points: [
      'Asigna una fecha de vencimiento a documentos como el SOAT, pasaporte, licencias o contratos.',
      'El panel de alertas te avisa en pantalla cuándo un documento está por vencer o ya venció.',
      'Puedes editar o eliminar la fecha de vencimiento en cualquier momento.',
    ],
    premiumNote: 'Premium / Empresarial: recibe correos automáticos 30, 8 y 1 día antes del vencimiento, con nota recordatoria personalizada.',
  },
  {
    id: 'preview',
    Icon: Eye,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    title: 'Vista previa y descarga',
    points: [
      'Haz clic en el ícono de ojo 👁 para previsualizar el archivo directamente en pantalla.',
      'PDF: se abre con barra de herramientas. Imágenes: vista completa. Audio/video: reproductor integrado.',
      'Descarga cualquier archivo con el ícono de descarga ↓.',
      'Los enlaces de acceso son temporales — expiran en 15 minutos por seguridad.',
    ],
    premiumNote: null,
  },
  {
    id: 'alerts',
    Icon: Bell,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    title: 'Alertas de vencimiento',
    points: [
      'El panel "Alertas de vencimiento" aparece automáticamente cuando tienes documentos próximos a vencer.',
      'Rojo: ya vencido. Naranja: vence en menos de 8 días. Amarillo: vence en menos de 30 días.',
      'Haz clic en el encabezado del panel para expandirlo o contraerlo.',
    ],
    premiumNote: 'Premium / Empresarial: además de las alertas en pantalla, recibes correos recordatorios automáticos.',
  },
  {
    id: 'security',
    Icon: ShieldCheck,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    title: 'Seguridad y privacidad',
    points: [
      'Todos tus archivos se almacenan cifrados en servidores seguros (Supabase / AWS).',
      'Solo tú puedes acceder a tus documentos — ni el administrador de la plataforma los puede ver.',
      'Los enlaces de descarga/vista previa expiran automáticamente cada 15 minutos.',
      'Para eliminar tu cuenta y todos tus datos, ve a Configuración → Eliminar cuenta.',
    ],
    premiumNote: null,
  },
];

// ── Features por plan ───────────────────────────────────────────────────────

const FREE_FEATURES    = [
  '50 MB de almacenamiento / hasta 15 documentos',
  'Formatos: PDF, Word, Excel, imágenes (JPEG, PNG, WebP)',
  'Alertas de vencimiento en pantalla',
  'Acceso cifrado desde cualquier dispositivo',
  '6 categorías por defecto',
];
const PREMIUM_FEATURES = [
  '500 MB de almacenamiento / hasta 200 documentos',
  'Todo lo del plan Gratuito',
  'Audio (MP3) y video corto (MP4)',
  'Notas de recordatorio por vencimiento',
  'Correos automáticos: 30, 8 y 1 día antes del vencimiento',
  'Hasta 25 categorías personalizadas',
];
const ENTERPRISE_FEATURES = [
  '5 GB de almacenamiento / documentos ilimitados',
  'Todo lo del plan Premium',
  'Panel de administrador',
  'Gestión multi-usuario con roles',
  'Categorías ilimitadas',
  'Soporte dedicado 24/7',
];
const LOCKED_FOR_FREE    = [
  '500 MB de almacenamiento (200 documentos)',
  'Archivos de audio (MP3) y video (MP4)',
  'Notas de recordatorio personalizadas',
  'Correos automáticos de vencimiento',
  'Hasta 25 categorías personalizadas',
];
const LOCKED_FOR_PREMIUM = [
  '5 GB de almacenamiento ilimitado',
  'Panel de administrador',
  'Gestión multi-usuario',
  'Soporte dedicado 24/7',
];

// ── Componente principal ────────────────────────────────────────────────────

export function OnboardingPanel({ documents, quota, onTriggerUpload }: OnboardingPanelProps) {
  const [dismissed,  setDismissed]  = useState(true); // true evita flash en hidratación
  const [collapsed,  setCollapsed]  = useState(false);
  const [activeTab,  setActiveTab]  = useState<Tab>('guide');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) { setDismissed(false); return; }
      const p = JSON.parse(raw);
      setDismissed(!!p.dismissed);
      setCollapsed(!!p.collapsed);
      if (p.tab) setActiveTab(p.tab as Tab);
    } catch { setDismissed(false); }
  }, []);

  const persist = (d: boolean, c: boolean, t: Tab) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ dismissed: d, collapsed: c, tab: t })); } catch {}
  };

  const handleDismiss  = () => { setDismissed(true);  persist(true, collapsed, activeTab); };
  const handleCollapse = () => { const c = !collapsed; setCollapsed(c); persist(dismissed, c, activeTab); };
  const handleTab      = (t: Tab) => { setActiveTab(t); persist(dismissed, collapsed, t); };

  const planType     = quota?.plan_type ?? 'free';
  const isPremium    = planType === 'premium';
  const isEnterprise = planType === 'enterprise';
  const isPaid       = isPremium || isEnterprise;

  // Pasos de progreso
  const steps = [
    { id: 'signup',   label: 'Crear tu cuenta',                       done: true,                                           action: null as null | { label: string; onClick?: () => void; href?: string } },
    { id: 'upload',   label: 'Subir tu primer documento',              done: documents.length > 0,                           action: documents.length === 0 ? { label: 'Subir ahora', onClick: onTriggerUpload } : null },
    { id: 'category', label: 'Organizar un documento por categoría',   done: documents.some((d: any) => d.category_id),      action: null },
    { id: 'expiry',   label: 'Asignar una fecha de vencimiento',       done: documents.some((d: any) => d.expiry_date),      action: null },
    { id: 'plan',     label: isPaid ? 'Plan de pago activo ✓' : 'Descubrir los planes Premium', done: isPaid,               action: !isPaid ? { label: 'Ver planes', href: '/dashboard/pricing' } : null },
  ];
  const completed = steps.filter(s => s.done).length;
  const pct       = Math.round((completed / steps.length) * 100);

  // Plan features
  const currentFeatures = isEnterprise ? ENTERPRISE_FEATURES : isPremium ? PREMIUM_FEATURES : FREE_FEATURES;
  const lockedFeatures  = isEnterprise ? [] : isPremium ? LOCKED_FOR_PREMIUM : LOCKED_FOR_FREE;
  const upgradePlan     = isPremium ? 'Empresarial' : 'Premium';
  const badgeLabel      = isEnterprise ? 'Empresarial' : isPremium ? 'Premium' : 'Gratuito';
  const badgeColor      = isEnterprise
    ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
    : isPremium
    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
    : 'bg-slate-700 text-slate-300';
  const upgradeBtnColor = isPremium
    ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border-purple-500/30'
    : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/30';

  if (dismissed || !quota) return null;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'guide', label: '¿Cómo funciona?' },
    { id: 'steps', label: `Mis pasos (${completed}/${steps.length})` },
    { id: 'plan',  label: 'Mi plan' },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/70 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">

      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">Guía de Baúl Digital</p>
            <p className="text-xs text-slate-400">Manual de usuario · {completed}/{steps.length} pasos completados</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 ml-2">
            <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{pct}%</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
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

      {/* ── Pestañas ── */}
      {!collapsed && (
        <>
          <div className="flex border-b border-white/5 bg-slate-900/40">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => handleTab(t.id)}
                className={`px-5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === t.id
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Guía ── */}
          {activeTab === 'guide' && (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[480px] overflow-y-auto">
              {GUIDE_SECTIONS.map(({ id, Icon, color, bg, title, points, premiumNote }) => (
                <div key={id} className={`rounded-xl border p-4 space-y-2.5 ${bg}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                    <p className={`text-sm font-semibold ${color}`}>{title}</p>
                  </div>
                  <ul className="space-y-1.5">
                    {points.map(pt => (
                      <li key={pt} className="flex items-start gap-1.5 text-xs text-slate-300 leading-relaxed">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-500 flex-shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                  {premiumNote && !isPaid && (
                    <div className="flex items-start gap-1.5 pt-1 border-t border-white/5">
                      <Zap className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-yellow-400/80 leading-relaxed">{premiumNote}</p>
                    </div>
                  )}
                  {premiumNote && isPaid && (
                    <div className="flex items-start gap-1.5 pt-1 border-t border-white/5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-emerald-400/80 leading-relaxed">{premiumNote}</p>
                    </div>
                  )}
                </div>
              ))}

              {/* Nota final */}
              <div className="sm:col-span-2 lg:col-span-3 flex items-start gap-2 p-3 rounded-xl bg-slate-800/50 border border-white/5">
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Esta guía permanece disponible mientras la necesites. Usa el botón <strong className="text-slate-300">─</strong> para
                  minimizarla o <strong className="text-slate-300">✕</strong> para ocultarla permanentemente.
                  Si tienes dudas adicionales, escríbenos desde el menú de soporte.
                </p>
              </div>
            </div>
          )}

          {/* ── Tab: Pasos ── */}
          {activeTab === 'steps' && (
            <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
                Completa estos pasos para sacar el máximo provecho
              </p>
              {steps.map(({ id, label, done, action }) => (
                <div key={id} className="flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-500'
                  }`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${done ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-200'}`}>
                      {label}
                    </p>
                    {action && !done && (
                      action.href
                        ? <Link href={action.href}
                            className="inline-flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                            {action.label} <ArrowRight className="w-3 h-3" />
                          </Link>
                        : <button onClick={action.onClick}
                            className="inline-flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                            {action.label} <ArrowRight className="w-3 h-3" />
                          </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab: Mi Plan ── */}
          {activeTab === 'plan' && (
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">

              {/* Features incluidas */}
              <div className="p-5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
                  Incluido en tu plan
                </p>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold mb-4 ${badgeColor}`}>
                  {badgeLabel}
                </span>
                <ul className="space-y-2">
                  {currentFeatures.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Features bloqueadas / CTA */}
              <div className="p-5">
                {lockedFeatures.length > 0 ? (
                  <>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
                      Desbloquea con {upgradePlan}
                    </p>
                    <ul className="space-y-2 mb-5">
                      {lockedFeatures.map(f => (
                        <li key={f} className="flex items-start gap-2 text-xs text-slate-500">
                          <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/dashboard/pricing"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${upgradeBtnColor}`}>
                      <Zap className="w-3.5 h-3.5" />
                      Conocer {upgradePlan}
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </>
                ) : (
                  <div className="flex items-start gap-2 text-xs text-emerald-400 mt-2">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Tienes acceso a <strong>todas las funcionalidades</strong> del sistema. Gracias por tu confianza.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
