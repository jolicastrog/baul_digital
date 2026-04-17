'use client';

import { useState, useEffect } from 'react';
import { Check, Zap, Shield, Building2, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';

type PlanType = 'free' | 'premium' | 'enterprise';
type BillingCycle = 'monthly' | 'semiannual' | 'annual';

interface PlanPrices {
  monthly: number;
  semiannual: number;
  annual: number;
}

interface Plan {
  id: PlanType;
  name: string;
  prices: PlanPrices | null;
  description: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  badgeColor: string;
  storage: string;
  documents: string;
  features: string[];
  ctaStyle: string;
  available: boolean;
  highlighted?: boolean;
}

const BILLING_OPTIONS: { id: BillingCycle; label: string; discount: string | null }[] = [
  { id: 'monthly',     label: 'Mensual',    discount: null },
  { id: 'semiannual', label: 'Semestral',  discount: '15% dto.' },
  { id: 'annual',     label: 'Anual',      discount: '25% dto.' },
];

// Precios base mensuales en COP
const PLAN_PRICES: Record<Exclude<PlanType, 'free'>, PlanPrices> = {
  premium: {
    monthly:    9900,
    semiannual: Math.round(9900 * 0.85),
    annual:     Math.round(9900 * 0.75),
  },
  enterprise: {
    monthly:    49900,
    semiannual: Math.round(49900 * 0.85),
    annual:     Math.round(49900 * 0.75),
  },
};

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Gratuito',
    prices: null,
    description: 'Para empezar a organizar tus documentos más importantes.',
    icon: <Shield className="w-6 h-6" />,
    color: 'text-slate-300',
    borderColor: 'border-white/10',
    badgeColor: 'bg-slate-700 text-slate-300',
    storage: '20 MB',
    documents: '15 documentos',
    features: [
      'Almacenamiento cifrado',
      'Categorías por defecto',
      'Alertas de vencimiento en pantalla',
      'Acceso desde cualquier dispositivo',
      'Eliminación y edición de fechas',
    ],
    ctaStyle: 'bg-slate-800 text-slate-400 cursor-default',
    available: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    prices: PLAN_PRICES.premium,
    description: 'Para familias y profesionales con mayor volumen documental.',
    icon: <Zap className="w-6 h-6" />,
    color: 'text-blue-400',
    borderColor: 'border-blue-500/40',
    badgeColor: 'bg-blue-600/20 text-blue-400 border border-blue-500/30',
    storage: '500 MB',
    documents: '500 documentos',
    features: [
      'Todo lo del plan gratuito',
      'Alertas por correo electrónico',
      'Categorías personalizadas ilimitadas',
      'Compartir documentos con familia',
      'Soporte prioritario',
    ],
    ctaStyle: 'bg-blue-600 hover:bg-blue-500 text-white',
    available: true,
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Empresarial',
    prices: PLAN_PRICES.enterprise,
    description: 'Para empresas que gestionan documentos de múltiples empleados.',
    icon: <Building2 className="w-6 h-6" />,
    color: 'text-purple-400',
    borderColor: 'border-purple-500/40',
    badgeColor: 'bg-purple-600/20 text-purple-400 border border-purple-500/30',
    storage: '5 GB',
    documents: 'Hasta agotar el almacenamiento',
    features: [
      'Todo lo del plan Premium',
      'Usuarios y roles ilimitados',
      'Panel de administrador',
      'Alertas por correo y SMS',
      'API de integración',
      'Soporte dedicado 24/7',
    ],
    ctaStyle: 'bg-purple-600 hover:bg-purple-500 text-white',
    available: true,
  },
];

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
    q: '¿Cuándo estarán disponibles los planes de pago?',
    a: 'Estamos trabajando en la integración de pagos. Serás notificado en cuanto estén disponibles.',
  },
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

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profile?.plan_type) setCurrentPlan(d.profile.plan_type); });

    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success') setPaymentMsg({ text: '¡Pago aprobado! Tu plan será actualizado en breve.', ok: true });
    if (payment === 'failed')  setPaymentMsg({ text: 'El pago no fue procesado. Intenta de nuevo.', ok: false });
    if (payment === 'pending') setPaymentMsg({ text: 'Tu pago está pendiente de confirmación.', ok: false });
  }, []);

  const handleCheckout = async (planId: PlanType) => {
    setLoadingPlan(planId);
    try {
      const res = await fetch('/api/payments/create-preference', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planType: planId, billingCycle: billing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.initPoint;
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
          Modo desarrollo — los botones "Simular pago" activan el plan sin pasar por MercadoPago
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

      {/* Tarjetas de planes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentPlan;
          const price = plan.prices ? plan.prices[billing] : null;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col bg-slate-900/50 backdrop-blur-xl rounded-2xl border p-6 transition-all ${plan.borderColor} ${
                plan.highlighted ? 'shadow-xl shadow-blue-500/10' : ''
              } ${isCurrent ? 'ring-2 ring-blue-500/40' : ''}`}
            >
              {plan.highlighted && !isCurrent && (
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
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.badgeColor}`}>
                  {plan.icon}
                </div>
                <div>
                  <h2 className={`font-bold text-lg ${plan.color}`}>{plan.name}</h2>
                  <p className="text-xs text-slate-500 leading-tight">{plan.description}</p>
                </div>
              </div>

              {/* Precio */}
              <div className="mb-2">
                {price !== null ? (
                  <>
                    <span className="text-4xl font-extrabold text-white">{formatCOP(price)}</span>
                    <span className="text-slate-500 text-sm ml-1">
                      <PeriodLabel cycle={billing} />
                    </span>
                    {billing !== 'monthly' && (
                      <p className="text-xs text-emerald-400 mt-1">
                        Ahorras {formatCOP((plan.prices!.monthly - price) * (billing === 'semiannual' ? 6 : 12))} COP/{billing === 'semiannual' ? 'semestre' : 'año'}
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
                  <p className="text-white font-bold text-sm">{plan.storage}</p>
                  <p className="text-slate-500 text-xs mt-0.5">Almacenamiento</p>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                  <p className="text-white font-bold text-xs leading-tight">{plan.documents}</p>
                  <p className="text-slate-500 text-xs mt-0.5">Documentos</p>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                disabled={!plan.available || isCurrent || loadingPlan === plan.id}
                onClick={() => plan.available && !isCurrent && handleCheckout(plan.id)}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${plan.ctaStyle} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loadingPlan === plan.id
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                  : isCurrent ? 'Plan actual'
                  : plan.available ? 'Contratar'
                  : 'Próximamente'}
              </button>

              {/* Botón de simulación — solo en desarrollo */}
              {IS_DEV && plan.available && !isCurrent && (
                <button
                  disabled={loadingPlan === plan.id}
                  onClick={() => handleSimulate(plan.id)}
                  className="w-full py-1.5 rounded-xl text-xs font-medium border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-all disabled:opacity-50 mt-1"
                >
                  {loadingPlan === plan.id ? 'Simulando...' : 'Simular pago (dev)'}
                </button>
              )}
            </div>
          );
        })}
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
                {PLANS.map(p => (
                  <th key={p.id} className={`px-6 py-3 font-semibold ${p.color}`}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                ['Almacenamiento',          '20 MB',        '500 MB',       '5 GB'],
                ['Documentos',              '15',           '500',          'Hasta agotar almacen.'],
                ['Alertas en pantalla',     '✓',            '✓',            '✓'],
                ['Alertas por email',        '—',            '✓',            '✓'],
                ['Alertas por SMS',          '—',            '—',            '✓'],
                ['Categorías personalizadas','6 fijas',      'Ilimitadas',   'Ilimitadas'],
                ['Compartir documentos',    '—',            '✓',            '✓'],
                ['Panel de administrador',  '—',            '—',            '✓'],
                ['Soporte',                 'Comunidad',    'Prioritario',  '24/7 dedicado'],
              ].map(([feature, ...values]) => (
                <tr key={feature} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-3 text-slate-400">{feature}</td>
                  {values.map((v, i) => (
                    <td key={i} className="px-6 py-3 text-center text-slate-200">{v}</td>
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
