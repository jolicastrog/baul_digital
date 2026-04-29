'use client';

import { useEffect, useState } from 'react';
import {
  Upload, FolderOpen, Calendar, Eye, Bell, ShieldCheck,
  CheckCircle2, Zap, ArrowRight, ChevronDown, ChevronUp,
  BookOpen, CreditCard,
} from 'lucide-react';
import Link from 'next/link';

// ── Secciones del manual ────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'upload',
    Icon: Upload,
    color: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    iconBg: 'bg-blue-500/15',
    title: 'Subir documentos',
    intro: 'Sube tus archivos de forma rápida y segura desde cualquier dispositivo.',
    steps: [
      { label: 'Abrir el panel de carga', desc: 'Haz clic en el botón "Subir Documento" que aparece en la parte superior de tu bóveda.' },
      { label: 'Seleccionar el archivo', desc: 'Arrastra el archivo directamente al área punteada, o haz clic en ella para abrir el explorador de archivos.' },
      { label: 'Elegir categoría (opcional)', desc: 'Asigna el documento a una categoría para mantenerlo organizado. Puedes hacerlo también después.' },
      { label: 'Asignar fecha de vencimiento (opcional)', desc: 'Si el documento tiene vigencia (SOAT, pasaporte, licencia), agrégala aquí para recibir alertas a tiempo.' },
    ],
    notes: [
      { text: 'Formatos soportados (todos los planes): PDF, Word (.doc/.docx), Excel (.xls/.xlsx), imágenes JPEG, PNG y WebP.', premium: false },
      { text: 'Las imágenes se comprimen automáticamente — el sistema las optimiza sin perder calidad visible.', premium: false },
      { text: 'Plan Premium / Empresarial: también puedes subir archivos de audio MP3 y video MP4 (clips cortos).', premium: true },
    ],
    limits: [
      { plan: 'Gratuito',     storage: '50 MB',   docs: '15 docs',         maxFile: '5 MB' },
      { plan: 'Premium',      storage: '500 MB',  docs: '200 docs',        maxFile: '50 MB' },
      { plan: 'Empresarial',  storage: '5 GB',    docs: 'Ilimitados',      maxFile: '100 MB' },
    ],
  },
  {
    id: 'categories',
    Icon: FolderOpen,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    iconBg: 'bg-emerald-500/15',
    title: 'Categorías',
    intro: 'Organiza tus documentos en grupos para encontrarlos de forma rápida.',
    steps: [
      { label: 'Asignar al subir', desc: 'Al subir un archivo, selecciona la categoría en el campo correspondiente del formulario.' },
      { label: 'Mover un documento', desc: 'Desde la lista de archivos, usa el ícono de carpeta (📁) en cada documento para cambiarlo de categoría.' },
      { label: 'Filtrar por categoría', desc: 'En el menú lateral izquierdo aparecen todas tus categorías. Haz clic en una para ver solo esos documentos.' },
    ],
    notes: [
      { text: 'El plan Gratuito incluye 6 categorías predefinidas (Identidad, Vehículo, Salud, Educación, Finanzas, Otros).', premium: false },
      { text: 'Plan Premium: crea hasta 25 categorías con el nombre que prefieras.', premium: true },
      { text: 'Plan Empresarial: categorías ilimitadas para equipos con alta variedad documental.', premium: true },
    ],
    limits: null,
  },
  {
    id: 'expiry',
    Icon: Calendar,
    color: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    bg: 'bg-orange-500/5',
    iconBg: 'bg-orange-500/15',
    title: 'Fechas de vencimiento',
    intro: 'Nunca más dejes vencer un documento importante. El sistema te avisa con anticipación.',
    steps: [
      { label: 'Asignar la fecha', desc: 'Al subir o editar un documento, selecciona la fecha de vencimiento en el campo "Fecha de Caducidad".' },
      { label: 'Ver el panel de alertas', desc: 'El panel "Alertas de vencimiento" aparece automáticamente en tu bóveda cuando tienes documentos próximos a vencer.' },
      { label: 'Editar o quitar la fecha', desc: 'Haz clic en el ícono de lápiz (✏️) del documento y modifica o elimina la fecha cuando sea necesario.' },
    ],
    notes: [
      { text: 'Rojo: documento ya vencido. Naranja: vence en menos de 8 días. Amarillo: vence en menos de 30 días.', premium: false },
      { text: 'Plan Premium / Empresarial: agrega una nota recordatoria personalizada, por ejemplo "Iniciar trámite de renovación 15 días antes".', premium: true },
      { text: 'Plan Premium / Empresarial: recibe correos automáticos 30, 8 y 1 día antes del vencimiento.', premium: true },
    ],
    limits: null,
  },
  {
    id: 'preview',
    Icon: Eye,
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
    iconBg: 'bg-purple-500/15',
    title: 'Vista previa y descarga',
    intro: 'Consulta o descarga cualquier documento sin complicaciones.',
    steps: [
      { label: 'Abrir la vista previa', desc: 'En la lista de documentos, haz clic en el ícono de ojo 👁 para abrir el archivo en pantalla completa.' },
      { label: 'Navegar el documento', desc: 'Los PDF se abren con barra de herramientas completa. Las imágenes se muestran a tamaño completo. El audio y video tienen reproductor integrado.' },
      { label: 'Descargar', desc: 'Usa el botón de descarga ↓ tanto en la lista como dentro de la vista previa para guardar el archivo en tu dispositivo.' },
    ],
    notes: [
      { text: 'Los enlaces de acceso expiran automáticamente cada 15 minutos por seguridad. Si el archivo no carga, cierra y vuelve a abrirlo.', premium: false },
      { text: 'Vista previa disponible para: PDF, imágenes (JPEG, PNG, WebP), audio MP3 y video MP4.', premium: false },
      { text: 'Para Word y Excel, usa el botón de descarga y ábrelos con tu aplicación de oficina.', premium: false },
    ],
    limits: null,
  },
  {
    id: 'alerts',
    Icon: Bell,
    color: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    bg: 'bg-yellow-500/5',
    iconBg: 'bg-yellow-500/15',
    title: 'Alertas de vencimiento',
    intro: 'El sistema monitorea tus documentos y te avisa cuando se acerca una fecha crítica.',
    steps: [
      { label: 'Panel de alertas en bóveda', desc: 'Aparece automáticamente en la parte superior de tu bóveda cuando tienes documentos con fechas próximas o vencidas.' },
      { label: 'Expandir o contraer', desc: 'Haz clic en el encabezado del panel para ver el detalle completo de los documentos con alerta.' },
      { label: 'Tomar acción', desc: 'Desde el panel puedes hacer clic en el documento para editarlo, cambiar la fecha o descargarlo.' },
    ],
    notes: [
      { text: 'Las alertas en pantalla son visibles para todos los planes sin costo adicional.', premium: false },
      { text: 'Plan Premium / Empresarial: además de la alerta en pantalla, recibes un correo electrónico automático 30 días, 8 días y 1 día antes del vencimiento.', premium: true },
      { text: 'Los correos de recordatorio pueden activarse o desactivarse desde el panel de administración.', premium: true },
    ],
    limits: null,
  },
  {
    id: 'security',
    Icon: ShieldCheck,
    color: 'text-red-400',
    borderColor: 'border-red-500/30',
    bg: 'bg-red-500/5',
    iconBg: 'bg-red-500/15',
    title: 'Seguridad y privacidad',
    intro: 'Tus documentos están protegidos con los más altos estándares de seguridad.',
    steps: [
      { label: 'Cifrado en reposo', desc: 'Todos tus archivos se almacenan cifrados en servidores de Supabase (infraestructura AWS). Nadie puede acceder al contenido sin tus credenciales.' },
      { label: 'Acceso exclusivo', desc: 'Solo tú puedes ver tus documentos. Ni el administrador de la plataforma tiene acceso al contenido de tus archivos.' },
      { label: 'URLs con expiración', desc: 'Los enlaces de vista previa y descarga se generan al momento y expiran automáticamente a los 15 minutos, evitando accesos no autorizados.' },
      { label: 'Eliminar tu cuenta', desc: 'Si deseas eliminar tu cuenta y todos tus datos, ve a Configuración → Eliminar cuenta. Tienes 30 días de periodo de gracia para cancelar la solicitud.' },
    ],
    notes: [
      { text: 'Cumplimiento de la Ley 1581 de 2012 (Habeas Data Colombia): tus datos personales y documentos son tratados con estricta confidencialidad.', premium: false },
      { text: 'No compartimos ni vendemos tu información a terceros bajo ninguna circunstancia.', premium: false },
    ],
    limits: null,
  },
];

// ── Tabla comparativa de planes ─────────────────────────────────────────────

const PLAN_COMPARISON = [
  { feature: 'Almacenamiento',              free: '50 MB',           premium: '500 MB',          enterprise: '5 GB' },
  { feature: 'Documentos máximos',          free: '15',              premium: '200',             enterprise: 'Ilimitados' },
  { feature: 'Tamaño máx. por archivo',     free: '5 MB',            premium: '50 MB',           enterprise: '100 MB' },
  { feature: 'Formatos',                    free: 'Docs + Imágenes', premium: '+ Audio y Video', enterprise: '+ Audio y Video' },
  { feature: 'Alertas en pantalla',         free: '✓',               premium: '✓',               enterprise: '✓' },
  { feature: 'Correos de recordatorio',     free: '—',               premium: '✓',               enterprise: '✓' },
  { feature: 'Nota de recordatorio',        free: '—',               premium: '✓',               enterprise: '✓' },
  { feature: 'Categorías',                  free: '6 predefinidas',  premium: 'Hasta 25',        enterprise: 'Ilimitadas' },
  { feature: 'Panel de administrador',      free: '—',               premium: '—',               enterprise: '✓' },
  { feature: 'Soporte',                     free: 'Comunidad',       premium: 'Prioritario',     enterprise: '24/7 dedicado' },
];

// ── Componente de sección ───────────────────────────────────────────────────

function GuideSection({ section, isOpen, onToggle }: {
  section: typeof SECTIONS[0];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { Icon, color, borderColor, bg, iconBg, title, intro, steps, notes, limits } = section;
  return (
    <div className={`rounded-2xl border ${borderColor} ${bg} overflow-hidden`}>
      {/* Encabezado colapsable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${color}`}>{title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{intro}</p>
          </div>
        </div>
        {isOpen
          ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>

      {/* Contenido */}
      {isOpen && (
        <div className="px-6 pb-6 space-y-5 border-t border-white/5 pt-5">

          {/* Pasos */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Cómo usarlo</p>
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${iconBg} ${color}`}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{s.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Notas */}
          {notes.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">A tener en cuenta</p>
              <ul className="space-y-2">
                {notes.map((n, i) => (
                  <li key={i} className={`flex items-start gap-2 text-xs leading-relaxed rounded-lg px-3 py-2 ${
                    n.premium
                      ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
                      : 'bg-slate-800/60 text-slate-300'
                  }`}>
                    {n.premium
                      ? <Zap className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                      : <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />}
                    {n.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tabla de límites por plan */}
          {limits && (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Límites por plan</p>
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800/60 border-b border-white/5">
                      <th className="text-left px-4 py-2 text-slate-400 font-medium">Plan</th>
                      <th className="text-center px-4 py-2 text-slate-400 font-medium">Almacenamiento</th>
                      <th className="text-center px-4 py-2 text-slate-400 font-medium">Documentos</th>
                      <th className="text-center px-4 py-2 text-slate-400 font-medium">Tamaño máx.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {limits.map(row => (
                      <tr key={row.plan} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-200">{row.plan}</td>
                        <td className="px-4 py-2.5 text-center text-slate-300">{row.storage}</td>
                        <td className="px-4 py-2.5 text-center text-slate-300">{row.docs}</td>
                        <td className="px-4 py-2.5 text-center text-slate-300">{row.maxFile}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────

export default function GuidePage() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ upload: true });
  const [planType, setPlanType] = useState<string>('free');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then((d: { profile?: { plan_type: string } } | null) => {
        if (d?.profile?.plan_type) setPlanType(d.profile.plan_type);
      });
  }, []);

  const toggle = (id: string) =>
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

  const expandAll   = () => setOpenSections(Object.fromEntries(SECTIONS.map(s => [s.id, true])));
  const collapseAll = () => setOpenSections({});

  const isPaid = planType === 'premium' || planType === 'enterprise';

  return (
    <div className="space-y-8 pb-12 max-w-3xl">

      {/* Cabecera */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Guía de usuario</h1>
            <p className="text-slate-400 text-sm">Manual completo del sistema Baúl Digital</p>
          </div>
        </div>

        {/* Banner plan gratuito */}
        {!isPaid && (
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mt-4">
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-300">
                Estás en el <strong>plan Gratuito</strong>. Las funciones marcadas con{' '}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-medium">
                  <Zap className="w-3 h-3" /> Premium
                </span>{' '}
                están disponibles en planes de pago.
              </p>
            </div>
            <Link href="/dashboard/pricing"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-colors whitespace-nowrap">
              Ver planes <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </header>

      {/* Controles */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{SECTIONS.length} secciones · haz clic en cada una para expandirla</p>
        <div className="flex gap-2">
          <button onClick={expandAll}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-white/5">
            Expandir todo
          </button>
          <button onClick={collapseAll}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-white/5">
            Colapsar todo
          </button>
        </div>
      </div>

      {/* Secciones */}
      <div className="space-y-4">
        {SECTIONS.map(section => (
          <GuideSection
            key={section.id}
            section={section}
            isOpen={!!openSections[section.id]}
            onToggle={() => toggle(section.id)}
          />
        ))}
      </div>

      {/* Tabla comparativa de planes */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-white text-sm">Comparativa de planes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-slate-900/40">
                <th className="text-left px-6 py-3 text-slate-400 font-medium">Característica</th>
                <th className="px-6 py-3 text-slate-300 font-semibold text-center">Gratuito</th>
                <th className="px-6 py-3 text-blue-400 font-semibold text-center">Premium</th>
                <th className="px-6 py-3 text-purple-400 font-semibold text-center">Empresarial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {PLAN_COMPARISON.map(row => (
                <tr key={row.feature} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-3 text-slate-400">{row.feature}</td>
                  <td className="px-6 py-3 text-center text-slate-300">{row.free}</td>
                  <td className="px-6 py-3 text-center text-slate-300">{row.premium}</td>
                  <td className="px-6 py-3 text-center text-slate-300">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-white/5">
          <Link href="/dashboard/pricing"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition-all">
            <CreditCard className="w-3.5 h-3.5" />
            Ver precios y contratar
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
