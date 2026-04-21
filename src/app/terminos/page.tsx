import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Términos y Condiciones – Baúl Digital',
};

const VERSION        = '2.0';
const VIGENCIA       = '21 de abril de 2026';
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
          archivos de forma segura a través de Internet. El servicio está diseñado para almacenar
          documentos de identidad, contratos, certificados y demás archivos de uso personal o
          profesional. <strong className="text-slate-300">Baúl Digital no es un gestor de
          contraseñas, una billetera digital ni un custodio de activos financieros.</strong>
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
            <li>El usuario es responsable de mantener la confidencialidad de su contraseña de acceso a Baúl Digital.</li>
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
            <li>
              <strong className="text-slate-300">No almacenar credenciales de seguridad de ningún tipo</strong>,
              incluyendo pero sin limitarse a: contraseñas bancarias, PINs, claves de acceso a plataformas
              financieras, frases semilla o claves privadas de billeteras de criptomonedas, códigos de
              respaldo de autenticación de dos factores (2FA), ni cualquier otra información cuya
              divulgación pueda comprometer su patrimonio o identidad digital. El incumplimiento de
              esta disposición es de exclusiva responsabilidad del usuario, conforme a lo establecido
              en la <strong className="text-slate-300">Ley 1273 de 2009</strong> sobre delitos
              informáticos y protección de la información en Colombia.
            </li>
          </ul>
        </Section>

        <Section title="5. Almacenamiento y contenido">
          <ul className="list-disc pl-5 space-y-1">
            <li>Cada plan incluye una cuota de almacenamiento determinada. Al superarla, no se podrán subir nuevos archivos hasta liberar espacio o cambiar de plan.</li>
            <li>Baúl Digital no se hace responsable por la pérdida de archivos causada por el usuario (eliminación accidental, etc.).</li>
            <li>El usuario es el único responsable del contenido que almacena en la plataforma.</li>
          </ul>
        </Section>

        {/* ── SECCIÓN NUEVA ── */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">
            6. Advertencia especial — Documentos de seguridad y patrimonio
          </h2>
          <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl p-5 text-slate-400 text-sm leading-relaxed space-y-3">
            <p>
              <strong className="text-amber-400">Baúl Digital es una plataforma de gestión documental,
              no un gestor de contraseñas ni un custodio de activos digitales.</strong> En consecuencia,
              se prohíbe expresamente almacenar en la plataforma los siguientes tipos de información:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-slate-300">Credenciales bancarias:</strong> contraseñas de
                portales de banca en línea, PINs de tarjetas débito o crédito, tokens de seguridad,
                preguntas secretas o cualquier código de acceso a productos financieros.
              </li>
              <li>
                <strong className="text-slate-300">Activos de criptomonedas:</strong> frases semilla
                (seed phrases) de 12 o 24 palabras, claves privadas (private keys), archivos Keystore,
                contraseñas de billeteras hardware o software, ni ningún dato que permita acceder o
                transferir activos digitales. La pérdida de estos datos por cualquier causa implica
                la pérdida irreversible de los activos, sin posibilidad de recuperación ni reclamación.
              </li>
              <li>
                <strong className="text-slate-300">Códigos de autenticación:</strong> códigos de
                respaldo 2FA, códigos de recuperación de cuentas de correo electrónico, redes sociales
                o servicios digitales, cuyo almacenamiento anularía la protección que ofrecen.
              </li>
              <li>
                <strong className="text-slate-300">Credenciales tributarias o gubernamentales:</strong>{' '}
                claves de acceso a la DIAN, portales de la SFC, firmas digitales o cualquier
                credencial de entidades públicas.
              </li>
            </ul>
            <p>
              <strong className="text-amber-400">Baúl Digital no se responsabiliza por daños
              patrimoniales, pérdida de activos financieros o digitales, ni por suplantación de
              identidad</strong> derivados del almacenamiento voluntario de este tipo de información
              por parte del usuario, en contravención de lo dispuesto en esta cláusula y en la
              <strong className="text-slate-300"> Ley 1273 de 2009</strong> (protección de la
              información y los datos) y la{' '}
              <strong className="text-slate-300">Ley 1581 de 2012</strong> (protección de datos
              personales). El usuario asume plena responsabilidad civil y penal por las consecuencias
              derivadas del incumplimiento de esta advertencia.
            </p>
            <p className="text-xs text-slate-500">
              Para el almacenamiento seguro de contraseñas, utilice un gestor de contraseñas
              certificado (p.ej. Bitwarden, 1Password). Para activos en criptomonedas, utilice
              billeteras hardware (cold storage) y nunca almacene su frase semilla en medios digitales
              conectados a Internet.
            </p>
          </div>
        </section>

        <Section title="7. Propiedad intelectual">
          El software, diseño, marca y contenidos de Baúl Digital son propiedad exclusiva de sus
          desarrolladores y están protegidos por las leyes de propiedad intelectual colombianas.
          El usuario no adquiere ningún derecho sobre ellos por el simple uso de la plataforma.
        </Section>

        <Section title="8. Disponibilidad del servicio">
          Baúl Digital realizará sus mejores esfuerzos para mantener la disponibilidad del servicio.
          Sin embargo, no garantiza disponibilidad ininterrumpida y se reserva el derecho de realizar
          mantenimientos programados o no programados. No se responsabiliza por daños derivados de
          interrupciones del servicio.
        </Section>

        <Section title="9. Modificación de los términos">
          Baúl Digital podrá modificar estos Términos en cualquier momento. Las modificaciones
          serán notificadas por correo electrónico o mediante un aviso visible en la plataforma con
          al menos 15 días de anticipación. El uso continuado después de la notificación implica la
          aceptación de los nuevos términos.
        </Section>

        {/* ── SECCIONES NUEVAS — CANCELACIÓN Y CIERRE ── */}
        <Section title="10. Cancelación de suscripción">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              El usuario con un plan de pago (Premium o Empresarial) puede cancelar su suscripción
              en cualquier momento desde la sección <em>Configuración → Suscripción</em> de su cuenta.
            </li>
            <li>
              La cancelación no genera reembolso proporcional del período ya pagado. El plan
              permanecerá activo hasta la fecha de vencimiento del período en curso, momento en
              el cual la cuenta pasará automáticamente al plan gratuito.
            </li>
            <li>
              La cancelación de la suscripción no implica el cierre de la cuenta ni la eliminación
              de los documentos almacenados; solo modifica el nivel de servicio al vencimiento
              del período.
            </li>
            <li>
              Baúl Digital se reserva el derecho de cancelar suscripciones activas en caso de
              incumplimiento de estos Términos, previa notificación al correo registrado.
            </li>
          </ul>
        </Section>

        <Section title="11. Cierre y eliminación de cuenta">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              El usuario puede solicitar el cierre definitivo de su cuenta desde la sección
              <em> Configuración → Zona de Peligro</em>.
            </li>
            <li>
              Una vez solicitado el cierre, la cuenta entra en un <strong className="text-slate-300">
              período de gracia de 30 días calendario</strong>. Durante este período el acceso
              permanece activo y el usuario puede cancelar la solicitud en cualquier momento.
            </li>
            <li>
              Vencido el período de gracia sin que el usuario haya cancelado la solicitud, Baúl
              Digital procederá a la eliminación definitiva e irreversible de la cuenta y todos
              los documentos almacenados.
            </li>
            <li>
              Si el usuario tiene una suscripción de pago activa al momento de solicitar el cierre,
              esta será cancelada automáticamente. No se realizarán reembolsos por el período
              no utilizado.
            </li>
            <li>
              Baúl Digital recomienda al usuario descargar y respaldar todos sus documentos antes
              de confirmar el cierre, utilizando la función <em>Exportar mis documentos</em>
              disponible en Configuración.
            </li>
            <li>
              Baúl Digital podrá cerrar cuentas de forma unilateral por incumplimiento grave de
              estos Términos, notificando al usuario con al menos 5 días hábiles de anticipación,
              salvo en casos de fraude, actividad ilegal o riesgo para terceros.
            </li>
          </ul>
        </Section>

        <Section title="12. Tratamiento de datos tras el cierre de cuenta">
          <p className="mb-2">
            En cumplimiento de la <strong className="text-slate-300">Ley 1581 de 2012</strong> y el{' '}
            <strong className="text-slate-300">Código de Comercio colombiano</strong>, una vez
            ejecutado el cierre de cuenta:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Los documentos personales cargados por el usuario serán eliminados de forma permanente
              de los servidores de Baúl Digital.
            </li>
            <li>
              Se conservará por un período de <strong className="text-slate-300">5 años</strong> un
              registro mínimo de identificación (nombre, correo, tipo de cuenta) y los registros
              de transacciones económicas (pagos, suscripciones), en cumplimiento de las
              obligaciones contables y tributarias establecidas en el Código de Comercio.
            </li>
            <li>
              Los registros de auditoría relacionados con la solicitud de cierre se conservarán
              por 5 años como evidencia ante posibles reclamaciones ante la{' '}
              <strong className="text-slate-300">Superintendencia de Industria y Comercio (SIC)</strong>.
            </li>
            <li>
              El usuario podrá solicitar en cualquier momento, durante el período de gracia,
              una copia de sus datos personales enviando una solicitud a{' '}
              <a href={`mailto:${EMAIL_CONTACTO}`} className="text-blue-400 hover:text-blue-300 underline">
                {EMAIL_CONTACTO}
              </a>
              . Baúl Digital responderá en un plazo máximo de 15 días hábiles, conforme al
              artículo 22 de la Ley 1581 de 2012.
            </li>
          </ul>
        </Section>

        <Section title="13. Obligaciones de notificación">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Baúl Digital notificará al usuario por correo electrónico al momento de recibir
              su solicitud de cierre de cuenta, confirmando la fecha programada de eliminación.
            </li>
            <li>
              Se enviará un recordatorio por correo antes de la ejecución definitiva del cierre,
              informando que aún puede cancelar la solicitud.
            </li>
            <li>
              Una vez ejecutada la eliminación, se enviará una notificación final de confirmación.
            </li>
            <li>
              En caso de incidente de seguridad que afecte los datos del usuario, Baúl Digital
              notificará en un plazo máximo de <strong className="text-slate-300">72 horas</strong>{' '}
              desde la detección, conforme a las buenas prácticas internacionales y las directrices
              de la SIC.
            </li>
          </ul>
        </Section>

        <Section title="14. Terminación del servicio por parte de Baúl Digital">
          Baúl Digital podrá suspender o cancelar el servicio de forma general con un preaviso
          mínimo de <strong className="text-slate-300">30 días calendario</strong>, notificado por
          correo electrónico a todos los usuarios activos. En dicho caso, los usuarios tendrán
          acceso a sus documentos durante el período de preaviso para descargarlos antes del
          cierre definitivo.
        </Section>

        <Section title="15. Ley aplicable y jurisdicción">
          Estos Términos se rigen por las leyes de la República de Colombia, en especial la
          Ley 1273 de 2009, la Ley 1581 de 2012, el Decreto 1377 de 2013 y el Código de Comercio.
          Cualquier controversia derivada del uso de la plataforma se someterá a la jurisdicción
          de los jueces competentes de la ciudad de Bogotá D.C., Colombia.
        </Section>

        <Section title="16. Contacto">
          Para cualquier inquietud relacionada con estos Términos, ejercicio de derechos de datos
          personales (acceso, rectificación, supresión, portabilidad) o notificación de incidentes,
          puede contactarnos en:{' '}
          <a href={`mailto:${EMAIL_CONTACTO}`} className="text-blue-400 hover:text-blue-300 underline">
            {EMAIL_CONTACTO}
          </a>
          . Tiempo de respuesta máximo: 15 días hábiles.
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
