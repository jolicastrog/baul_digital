'use client';

import { useState, useEffect } from 'react';
import { Check, Zap, Shield, Building2, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';

type PlanType = 'free' | 'premium' | 'enterprise';
type BillingCycle = 'monthly' | 'semiannual' | 'annual';

// Datos que vienen de la BD
interface DbPlan {
  code:                 string;
  name:                 string;
  storage_bytes:        number;
  max_documents:        number | null;
  max_file_size_mb:     number;
  price_monthly_cop:    number;
  price_semiannual_cop: number;
  price_annual_cop:     number;
  is_active:            boolean;
}

// Configuración UI estática (no precios)
interface PlanConfig {
  id:          PlanType;
  description: string;
  icon:        React.ReactNode;
  color:       string;
  borderColor: string;
  badgeColor:  string;
  features:    string[];
  ctaStyle:    string;
  highlighted?: boolean;
}

const BILLING_OPTIONS: { id: BillingCycle; label: string; discount: string | null }[] = [
  { id: 'monthly',    label: 'Mensual',   discount: null },
  { id: 'semiannual', label: 'Semestral', discount: '15% dto.' },
  { id: 'annual',     label: 'Anual',     discount: '25% dto.' },
];

// Configuración visual estática — nombres, colores, features (no precios)
const PLAN_CONFIG: Record<PlanType, PlanConfig> = {
  free: {
    id: 'free',
    description: 'Para empezar a organizar tus documentos más importantes.',
    icon: <Shield className="w-6 h-6" />,
    color: 'text-slate-300',
    borderColor: 'border-white/10',
    badgeColor: 'bg-slate-700 text-slate-300',
    features: [
      'Almacenamiento cifrado',
      'Categorías por defecto',
      'Alertas de vencimiento en pantalla',
      'Acceso desde cualquier dispositivo',
      'Eliminación y edición de fechas',
    ],
    ctaStyle: 'bg-slate-800 text-slate-400 cursor-default',
  },
  premium: {
    id: 'premium',
    description: 'Para profesionales con mayor volumen documental.',
    icon: <Zap className="w-6 h-6" />,
    color: 'text-blue-400',
    borderColor: 'border-blue-500/40',
    badgeColor: 'bg-blue-600/20 text-blue-400 border border-blue-500/30',
    features: [
      'Todo lo del plan gratuito',
      'Hasta 25 categorías personalizadas',
      'Nota de recordatorio por fecha de vencimiento',
      'Archivos de hasta 10 MB por subida',
      'Soporte prioritario',
    ],
    ctaStyle: 'bg-blue-600 hover:bg-blue-500 text-white',
    highlighted: true,
  },
  enterprise: {
    id: 'enterprise',
    description: 'Para empresas que gestionan documentos de múltiples empleados.',
    icon: <Building2 className="w-6 h-6" />,
    color: 'text-purple-400',
    borderColor: 'border-purple-500/40',
    badgeColor: 'bg-purple-600/20 text-purple-400 border border-purple-500/30',
    features: [
      'Todo lo del plan Premium',
      'Usuarios y roles ilimitados',
      'Panel de administrador',
      'Archivos de hasta 50 MB por subida',
      'Soporte dedicado 24/7',
    ],
    ctaStyle: 'bg-purple-600 hover:bg-purple-500 text-white',
  },
};

const FAQ = [
  {
    q: '¿Puedo cambiar de plan en cualquier momento?',
    a: 'Sí, cuando los planes de pago estén disponibles podrás actualizar o degradar tu plan desde esta misma pantalla sin perder ningún documento.',
  },
  {
    q: '¿Qué pasa con mis documentos si supero el límite?',
    a: 'No se elimina ningún documento. Simplemente no podrás subir nuevos hasta que elimines algunos o actualices a un plan superior.',
  },
  {
    q: '¿Mis documentos están seguros?',
    a: 'Sí. Todos los archivos se almacenan cifrados en servidores de Supabase. Solo tú puedes acceder a ellos mediante URLs firmadas con expiración de 15 minutos.',
  },
  {
    q: '¿El descuento semestral o anual aplica desde el primer pago?',
    a: 'Sí. El precio mostrado ya refleja el descuento aplicado al periodo seleccionado. Se factura por adelantado al inicio del periodo.',
  },
  {
    q: '¿Qué métodos de pago se aceptan?',
    a: 'Aceptamos tarjetas de crédito y débito a través de Bold, pasarela de pagos colombiana. El cobro se realiza por adelantado al inicio de cada periodo.',
  },
];

const COMPARISON_DATA: Array<{ feature: string; free: string; premium: string; enterprise: string }> = [
  { feature: 'Almacenamiento',          free: '20 MB',         premium: '500 MB',      enterprise: '5 GB' },
  { feature: 'Documentos',              free: '15',            premium: '500',         enterprise: 'Hasta agotar almacen.' },
  { feature: 'Tamaño máx. por archivo', free: '2 MB',          premium: '10 MB',       enterprise: '50 MB' },
  { feature: 'Alertas en pantalla',     free: '✓',             premium: '✓',           enterprise: '✓' },
  { feature: 'Nota por vencimiento',    free: '—',             premium: '✓',           enterprise: '✓' },
  { feature: 'Categorías',              free: '6 por defecto', premium: 'Hasta 25',    enterprise: 'Ilimitadas' },
  { feature: 'Panel de administrador',  free: '—',             premium: '—',           enterprise: '✓' },
  { feature: 'Soporte',                 free: 'Comunidad',     premium: 'Prioritario', enterprise: '24/7 dedicado' },
];

function formatCOP(amount: number) {
  return '$' + amount.toLocaleString('es-CO');
}

function PeriodLabel({ cycle }: { cycle: BillingCycle }) {
  if (cycle === 'monthly')    return <>/mes</>;
  if (cycle === 'semiannual') return <>/mes <span className="text-xs text-slate-500">(cobro semestral)</span></>;
  return <>/mes <span className="text-xs text-slate-500">(cobro anual)</span></>;
}

const IS_DEV = process.env.NEXT_PUBLIC_APP_ENV !== 'production';

export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState<PlanType>('free');
  const [billing, setBilling]         = useState<BillingCycle>('monthly');
  const [openFaq, setOpenFaq]         = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);
  const [paymentMsg, setPaymentMsg]   = useState<{ text: string; ok: boolean } | null>(null);
  // Planes desde BD (fuente de verdad para precios y visibilidad)
  const [dbPlans, setDbPlans]           = useState<Record<string, DbPlan>>({});
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError]     = useState(false);

  useEffect(() => {
    // Cargar plan activo del usuario
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profile?.plan_type) setCurrentPlan(d.profile.plan_type); });

    // Cargar planes desde BD (respeta is_active y precios reales)
    fetch('/api/plans', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        const map: Record<string, DbPlan> = {};
        (d.plans as DbPlan[]).forEach(p => { map[p.code] = p; });
        setDbPlans(map);
      })
      .catch(err => {
        console.error('[pricing] Error cargando planes:', err);
        setPlansError(true);
      })
      .finally(() => setPlansLoading(false));

    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success') setPaymentMsg({ text: '¡Pago aprobado! Tu plan será actualizado en breve.', ok: true });
    if (payment === 'failed')  setPaymentMsg({ text: 'El pago no fue procesado. Intenta de nuevo.', ok: false });
    if (payment === 'pending') setPaymentMsg({ text: 'Tu pago está pendiente de confirmación.', ok: false });
  }, []);

  const handleCheckout = async (planId: PlanType) => {
    setLoadingPlan(planId);
    try {
      const res = await fetch('/api/payments/create-bold-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planType: planId, billingCycle: billing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.paymentUrl;
    } catch (err: any) {
      setPaymentMsg({ text: err.message || 'Error al iniciar el pago.', ok: false });
      setLoadingPlan(null);
    }
  };

  const handleSimulate = async (planId: PlanType) => {
    setLoadingPlan(planId);
    try {
      const res = await fetch('/api/payments/simulate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planType: planId, billingCycle: billing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPaymentMsg({ text: `✓ Pago simulado. ID: ${data.transactionId}`, ok: true });
      // Refrescar plan actual
      fetch('/api/auth/me').then(r => r.json()).then(d => {
        if (d?.profile?.plan_type) setCurrentPlan(d.profile.plan_type);
      });
    } catch (err: any) {
      setPaymentMsg({ text: err.message || 'Error en simulación.', ok: false });
    } finally {
      setLoadingPlan(null);
    }
  };

  const activePlansConfig = (Object.values(PLAN_CONFIG) as PlanConfig[])
    .filter(cfg => cfg.id === 'free' || !!dbPlans[cfg.id]);

  return (
    <div className="space-y-10 pb-12 max-w-5xl">
      <header className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-white tracking-tight">Planes y Precios</h1>
        <p className="text-slate-400 max-w-xl mx-auto">
          Elige el plan que se adapta a tus necesidades. Empieza gratis y actualiza cuando lo necesites.
        </p>
      </header>

      {paymentMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium text-center ${
          paymentMsg.ok
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
        }`}>
          {paymentMsg.text}
        </div>
      )}

      {IS_DEV && (
        <div className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-yellow-400 text-xs text-center">
          Modo desarrollo — los botones "Simular pago" activan el plan sin pasar por Bold
        </div>
      )}

      {/* Selector de ciclo de pago */}
      <div className="flex items-center justify-center">
        <div className="inline-flex bg-slate-900/60 border border-white/10 rounded-xl p-1 gap-1">
          {BILLING_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setBilling(opt.id)}
              className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === opt.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
              {opt.discount && (
                <span className={`absolute -top-2.5 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  billing === opt.id ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {opt.discount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error cargando planes */}
      {plansError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
          No se pudieron cargar los planes. Recarga la página.
        </div>
      )}

      {/* Tarjetas de planes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plansLoading
          ? /* Skeleton mientras carga */
            [1, 2, 3].map(i => (
              <div key={i} className="h-96 bg-slate-900/50 rounded-2xl border border-white/5 animate-pulse" />
            ))
          : activePlansConfig.map(cfg => {
                const db        = dbPlans[cfg.id];
                const isCurrent = cfg.id === currentPlan;
                const isPaid    = cfg.id !== 'free';

                // Precio por mes según ciclo (desde BD)
                const pricePerMonth = db
                  ? billing === 'monthly'    ? db.price_monthly_cop
                  : billing === 'semiannual' ? db.price_semiannual_cop
                  : db.price_annual_cop
                  : null;

                // Límites legibles desde BD (o fallback para free)
                const storageLabel = db
                  ? db.storage_bytes >= 1e9
                    ? `${(db.storage_bytes / 1e9).toFixed(0)} GB`
                    : `${(db.storage_bytes / 1e6).toFixed(0)} MB`
                  : '20 MB';
                const docsLabel = db
                  ? db.max_documents ? `${db.max_documents} documentos` : 'Hasta agotar almacenamiento'
                  : '15 documentos';

                return (
                  <div
                    key={cfg.id}
                    className={`relative flex flex-col bg-slate-900/50 backdrop-blur-xl rounded-2xl border p-6 transition-all ${cfg.borderColor} ${
                      cfg.highlighted ? 'shadow-xl shadow-blue-500/10' : ''
                    } ${isCurrent ? 'ring-2 ring-blue-500/40' : ''}`}
                  >
                    {cfg.highlighted && !isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                        <Sparkles className="w-3 h-3" /> Más popular
                      </span>
                    )}
                    {isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                        Tu plan actual
                      </span>
                    )}

                    {/* Cabecera */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.badgeColor}`}>
                        {cfg.icon}
                      </div>
                      <div>
                        <h2 className={`font-bold text-lg ${cfg.color}`}>{db?.name ?? cfg.id}</h2>
                        <p className="text-xs text-slate-500 leading-tight">{cfg.description}</p>
                      </div>
                    </div>

                    {/* Precio */}
                    <div className="mb-2">
                      {isPaid && pricePerMonth !== null ? (
                        <>
                          <span className="text-4xl font-extrabold text-white">{formatCOP(pricePerMonth)}</span>
                          <span className="text-slate-500 text-sm ml-1">
                            <PeriodLabel cycle={billing} />
                          </span>
                          {billing !== 'monthly' && db && (
                            <p className="text-xs text-emerald-400 mt-1">
                              Ahorras {formatCOP(
                                (db.price_monthly_cop - pricePerMonth) * (billing === 'semiannual' ? 6 : 12)
                              )} COP/{billing === 'semiannual' ? 'semestre' : 'año'}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-4xl font-extrabold text-white">$0</span>
                          <span className="text-slate-500 text-sm ml-1">Siempre gratis</span>
                        </>
                      )}
                    </div>

                    {/* Límites destacados */}
                    <div className="grid grid-cols-2 gap-2 my-5">
                      <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                        <p className="text-white font-bold text-sm">{storageLabel}</p>
                        <p className="text-slate-500 text-xs mt-0.5">Almacenamiento</p>
                      </div>
                      <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                        <p className="text-white font-bold text-xs leading-tight">{docsLabel}</p>
                        <p className="text-slate-500 text-xs mt-0.5">Documentos</p>
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2.5 mb-8 flex-1">
                      {cfg.features.map(f => (
                        <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      disabled={!isPaid || isCurrent || loadingPlan === cfg.id}
                      onClick={() => isPaid && !isCurrent && handleCheckout(cfg.id)}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${cfg.ctaStyle} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loadingPlan === cfg.id
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                        : isCurrent  ? 'Plan actual'
                        : isPaid     ? 'Contratar'
                        : 'Plan gratuito'}
                    </button>

                    {/* Botón de simulación — solo en desarrollo */}
                    {IS_DEV && isPaid && !isCurrent && (
                      <button
                        disabled={loadingPlan === cfg.id}
                        onClick={() => handleSimulate(cfg.id)}
                        className="w-full py-1.5 rounded-xl text-xs font-medium border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-all disabled:opacity-50 mt-1"
                      >
                        {loadingPlan === cfg.id ? 'Simulando...' : 'Simular pago (dev)'}
                      </button>
                    )}
                  </div>
                );
              })
        }
      </div>

      {/* Comparativa rápida */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-semibold text-white">Comparativa rápida</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Característica</th>
                {activePlansConfig.map(p => (
                  <th key={p.id} className={`px-6 py-3 font-semibold ${p.color}`}>{dbPlans[p.id]?.name ?? p.id}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {COMPARISON_DATA.map((row) => (
                <tr key={row.feature} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-3 text-slate-400">{row.feature}</td>
                  {activePlansConfig.map(cfg => (
                    <td key={cfg.id} className="px-6 py-3 text-center text-slate-200">
                      {row[cfg.id as keyof typeof row]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-3">
        <h2 className="font-semibold text-white text-lg">Preguntas frecuentes</h2>
        {FAQ.map((item, i) => (
          <div key={i} className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-sm font-medium text-slate-200">{item.q}</span>
              {openFaq === i
                ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
            </button>
            {openFaq === i && (
              <div className="px-5 pb-4 text-sm text-slate-400 border-t border-white/5 pt-3">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
