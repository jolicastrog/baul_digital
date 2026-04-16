import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Política de Privacidad – Baúl Digital',
};

const VERSION        = '1.0';
const VIGENCIA       = '16 de abril de 2025';
const EMAIL_CONTACTO = 'legal@mibauldigital.com';
const RESPONSABLE    = 'Baúl Digital';

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-10">

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Política de Privacidad y Tratamiento de Datos Personales
            </h1>
            <p className="text-xs text-slate-500">Versión {VERSION} · Vigente desde {VIGENCIA}</p>
          </div>
        </div>

        <p className="text-slate-400 text-sm leading-relaxed">
          En cumplimiento de la <strong className="text-slate-200">Ley 1581 de 2012</strong>,
          el <strong className="text-slate-200">Decreto 1377 de 2013</strong> y demás normas
          concordantes sobre Protección de Datos Personales en Colombia,{' '}
          <strong className="text-slate-200">{RESPONSABLE}</strong> establece la presente
          Política de Privacidad para informarle cómo recopilamos, usamos y protegemos sus
          datos personales.
        </p>

        <Section title="1. Responsable del tratamiento">
          <p><strong className="text-slate-300">Nombre:</strong> {RESPONSABLE}</p>
          <p><strong className="text-slate-300">Correo de contacto:</strong>{' '}
            <a href={`mailto:${EMAIL_CONTACTO}`} className="text-blue-400 hover:text-blue-300 underline">
              {EMAIL_CONTACTO}
            </a>
          </p>
          <p><strong className="text-slate-300">Dominio:</strong> mibauldigital.com</p>
        </Section>

        <Section title="2. Datos personales que recopilamos">
          <p className="mb-2">Al registrarse y usar la plataforma, recopilamos los siguientes datos:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-slate-300">Identificación:</strong> nombres, apellidos, tipo y número de documento.</li>
            <li><strong className="text-slate-300">Contacto:</strong> correo electrónico y teléfono (opcional).</li>
            <li><strong className="text-slate-300">Seguridad:</strong> contraseña cifrada (nunca almacenamos contraseñas en texto plano).</li>
            <li><strong className="text-slate-300">Documentos:</strong> archivos que usted carga voluntariamente a la plataforma.</li>
            <li><strong className="text-slate-300">Uso:</strong> registros de actividad (logs) para auditoría de seguridad.</li>
          </ul>
        </Section>

        <Section title="3. Finalidad del tratamiento">
          Sus datos personales son utilizados para:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Crear y gestionar su cuenta de usuario.</li>
            <li>Proveer el servicio de almacenamiento y gestión de documentos.</li>
            <li>Garantizar la seguridad e integridad de su información.</li>
            <li>Enviar notificaciones relacionadas con el servicio (cambios de contraseña, alertas de seguridad).</li>
            <li>Cumplir con obligaciones legales aplicables.</li>
          </ul>
          <p className="mt-2">
            <strong className="text-slate-300">No vendemos, arrendamos ni compartimos</strong> sus datos
            personales con terceros con fines comerciales.
          </p>
        </Section>

        <Section title="4. Base legal del tratamiento">
          El tratamiento de sus datos se realiza con fundamento en:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong className="text-slate-300">Su autorización expresa</strong> otorgada al momento del registro.</li>
            <li>La ejecución del contrato de prestación del servicio.</li>
            <li>El cumplimiento de obligaciones legales (Ley 1581/2012).</li>
          </ul>
        </Section>

        <Section title="5. Almacenamiento y seguridad">
          <ul className="list-disc pl-5 space-y-1">
            <li>Los datos se almacenan en servidores seguros provistos por <strong className="text-slate-300">Supabase</strong> con cifrado en reposo y en tránsito (TLS).</li>
            <li>Las contraseñas se almacenan con hash criptográfico (bcrypt).</li>
            <li>Los archivos se almacenan en buckets privados con control de acceso por usuario.</li>
            <li>El acceso a los datos está restringido al personal autorizado.</li>
          </ul>
        </Section>

        <Section title="6. Plazo de conservación">
          Sus datos personales se conservarán mientras su cuenta esté activa o por el tiempo
          necesario para cumplir con las finalidades descritas, y en todo caso, no menos de{' '}
          <strong className="text-slate-300">5 años</strong> desde la última actividad de la cuenta,
          conforme a las obligaciones legales aplicables.
        </Section>

        <Section title="7. Derechos del titular (Habeas Data)">
          <p className="mb-2">
            De acuerdo con la Ley 1581 de 2012, usted como titular tiene derecho a:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-slate-300">Conocer</strong> los datos personales que tenemos sobre usted.</li>
            <li><strong className="text-slate-300">Actualizar y corregir</strong> sus datos cuando sean inexactos o incompletos.</li>
            <li><strong className="text-slate-300">Suprimir</strong> sus datos cuando no sean necesarios para la finalidad original (derecho al olvido).</li>
            <li><strong className="text-slate-300">Revocar</strong> la autorización otorgada para el tratamiento.</li>
            <li><strong className="text-slate-300">Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC).</li>
          </ul>
          <p className="mt-2">
            Para ejercer estos derechos, envíe su solicitud a{' '}
            <a href={`mailto:${EMAIL_CONTACTO}`} className="text-blue-400 hover:text-blue-300 underline">
              {EMAIL_CONTACTO}
            </a>{' '}
            con su nombre completo, número de documento y la solicitud específica.
            Responderemos en un plazo máximo de <strong className="text-slate-300">15 días hábiles</strong>.
          </p>
        </Section>

        <Section title="8. Transferencia de datos a terceros">
          Baúl Digital puede compartir datos con terceros únicamente en los siguientes casos:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong className="text-slate-300">Proveedores de infraestructura</strong> (Supabase, Vercel) que actúan como encargados del tratamiento bajo acuerdos de confidencialidad.</li>
            <li><strong className="text-slate-300">Autoridades competentes</strong> cuando sea requerido por ley o en cumplimiento de una orden judicial.</li>
          </ul>
          <p className="mt-2">No realizamos transferencias internacionales de datos fuera del marco de los proveedores mencionados.</p>
        </Section>

        <Section title="9. Cookies y datos de navegación">
          La plataforma utiliza cookies de sesión estrictamente necesarias para mantener la
          autenticación del usuario. No utilizamos cookies de rastreo ni publicidad de terceros.
        </Section>

        <Section title="10. Menores de edad">
          La plataforma no está dirigida a menores de 14 años. Los usuarios entre 14 y 18 años
          deben contar con la autorización de su representante legal para registrarse.
        </Section>

        <Section title="11. Cambios en esta política">
          Baúl Digital podrá actualizar esta Política periódicamente. Cualquier cambio relevante
          será notificado al correo electrónico registrado con al menos{' '}
          <strong className="text-slate-300">15 días de anticipación</strong>. La versión vigente
          siempre estará disponible en esta página.
        </Section>

        <Section title="12. Autoridad de control">
          La autoridad encargada de velar por el cumplimiento de la protección de datos en Colombia es la{' '}
          <strong className="text-slate-300">Superintendencia de Industria y Comercio (SIC)</strong>.
          Puede consultar más información en{' '}
          <a
            href="https://www.sic.gov.co"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            www.sic.gov.co
          </a>
          .
        </Section>

        <div className="pt-6 border-t border-white/5 flex flex-wrap gap-4 items-center">
          <Link href="/register" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            ← Volver al registro
          </Link>
          <Link href="/terminos" className="text-slate-400 hover:text-slate-300 text-sm transition-colors">
            Ver Términos y Condiciones
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
      <div className="text-slate-400 text-sm leading-relaxed space-y-1">{children}</div>
    </section>
  );
}
