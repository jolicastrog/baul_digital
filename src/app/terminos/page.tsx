import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Términos y Condiciones – Baúl Digital',
};

const VERSION   = '1.0';
const VIGENCIA  = '16 de abril de 2025';
const EMAIL_CONTACTO = 'legal@mibauldigital.com';

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-10">

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Términos y Condiciones de Uso</h1>
            <p className="text-xs text-slate-500">Versión {VERSION} · Vigente desde {VIGENCIA}</p>
          </div>
        </div>

        <p className="text-slate-400 text-sm leading-relaxed">
          Bienvenido a <strong className="text-slate-200">Baúl Digital</strong>. Al crear una cuenta y
          utilizar la plataforma, usted acepta los presentes Términos y Condiciones. Léalos
          detenidamente antes de continuar.
        </p>

        <Section title="1. Objeto del servicio">
          Baúl Digital es una plataforma de almacenamiento y gestión digital de documentos personales
          e importantes, que permite a los usuarios cargar, organizar, consultar y descargar sus
          archivos de forma segura a través de Internet.
        </Section>

        <Section title="2. Aceptación de los términos">
          El uso de la plataforma implica la aceptación plena y sin reservas de estos Términos y
          Condiciones, así como de la{' '}
          <Link href="/privacidad" className="text-blue-400 hover:text-blue-300 underline">
            Política de Privacidad y Tratamiento de Datos Personales
          </Link>
          . Si no está de acuerdo con alguna disposición, debe abstenerse de usar el servicio.
        </Section>

        <Section title="3. Registro y cuenta de usuario">
          <ul className="list-disc pl-5 space-y-1">
            <li>El usuario debe ser mayor de 14 años o contar con la autorización de su representante legal.</li>
            <li>La información suministrada al registrarse debe ser veraz, completa y actualizada.</li>
            <li>El usuario es responsable de mantener la confidencialidad de su contraseña.</li>
            <li>Baúl Digital se reserva el derecho de suspender cuentas con información falsa o actividad irregular.</li>
          </ul>
        </Section>

        <Section title="4. Uso permitido de la plataforma">
          <p className="mb-2">El usuario se compromete a:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Usar la plataforma únicamente para fines lícitos y personales.</li>
            <li>No cargar contenido ilegal, ofensivo, malicioso o que viole derechos de terceros.</li>
            <li>No intentar acceder a cuentas de otros usuarios ni vulnerar la seguridad del sistema.</li>
            <li>No realizar ingeniería inversa, descompilar o copiar el software de la plataforma.</li>
          </ul>
        </Section>

        <Section title="5. Almacenamiento y contenido">
          <ul className="list-disc pl-5 space-y-1">
            <li>Cada plan incluye una cuota de almacenamiento determinada. Al superarla, no se podrán subir nuevos archivos hasta liberar espacio o cambiar de plan.</li>
            <li>Baúl Digital no se hace responsable por la pérdida de archivos causada por el usuario (eliminación accidental, etc.).</li>
            <li>El usuario es el único responsable del contenido que almacena en la plataforma.</li>
          </ul>
        </Section>

        <Section title="6. Propiedad intelectual">
          El software, diseño, marca y contenidos de Baúl Digital son propiedad exclusiva de sus
          desarrolladores y están protegidos por las leyes de propiedad intelectual colombianas.
          El usuario no adquiere ningún derecho sobre ellos por el simple uso de la plataforma.
        </Section>

        <Section title="7. Disponibilidad del servicio">
          Baúl Digital realizará sus mejores esfuerzos para mantener la disponibilidad del servicio.
          Sin embargo, no garantiza disponibilidad ininterrumpida y se reserva el derecho de realizar
          mantenimientos programados o no programados. No se responsabiliza por daños derivados de
          interrupciones del servicio.
        </Section>

        <Section title="8. Modificación de los términos">
          Baúl Digital podrá modificar estos Términos en cualquier momento. Las modificaciones
          serán notificadas por correo electrónico o mediante un aviso visible en la plataforma.
          El uso continuado después de la notificación implica la aceptación de los nuevos términos.
        </Section>

        <Section title="9. Terminación del servicio">
          El usuario puede eliminar su cuenta en cualquier momento desde la configuración de su perfil.
          Baúl Digital podrá suspender o cancelar cuentas que incumplan estos Términos, previa
          notificación al correo registrado.
        </Section>

        <Section title="10. Ley aplicable y jurisdicción">
          Estos Términos se rigen por las leyes de la República de Colombia. Cualquier controversia
          derivada del uso de la plataforma se someterá a la jurisdicción de los jueces competentes
          de la ciudad de Bogotá D.C., Colombia.
        </Section>

        <Section title="11. Contacto">
          Para cualquier inquietud relacionada con estos Términos, puede contactarnos en:{' '}
          <a href={`mailto:${EMAIL_CONTACTO}`} className="text-blue-400 hover:text-blue-300 underline">
            {EMAIL_CONTACTO}
          </a>
        </Section>

        <div className="pt-6 border-t border-white/5">
          <Link href="/register" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            ← Volver al registro
          </Link>
        </div>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="text-slate-400 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
