const BASE_URL = 'https://www.mibauldigital.com';

const layout = (content: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Baúl Digital</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:28px 32px;text-align:center;">
            <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">🗄 Baúl Digital</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              © 2026 Baúl Digital · <a href="${BASE_URL}/terminos" style="color:#94a3b8;">Términos</a> · <a href="${BASE_URL}/privacidad" style="color:#94a3b8;">Privacidad</a>
            </p>
            <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">mibauldigital.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

/* ── Helpers ─────────────────────────────────────────────── */
const h1 = (text: string) =>
  `<h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1e293b;">${text}</h1>`;

const p = (text: string) =>
  `<p style="margin:0 0 14px;font-size:15px;color:#475569;line-height:1.6;">${text}</p>`;

const btn = (text: string, url: string, color = '#2563eb') =>
  `<a href="${url}" style="display:inline-block;margin:8px 0 16px;padding:12px 28px;background:${color};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${text}</a>`;

const warning = (text: string) =>
  `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:14px 16px;margin:16px 0;font-size:14px;color:#92400e;">${text}</div>`;

/* ── Templates ───────────────────────────────────────────── */

export function subscriptionCancelledHtml(opts: {
  fullName:  string;
  planLabel: string;
  periodEnd: string;
}) {
  const { fullName, planLabel, periodEnd } = opts;
  return layout(`
    ${h1('Suscripción cancelada')}
    ${p(`Hola <strong>${fullName}</strong>, hemos registrado la cancelación de tu plan <strong>${planLabel}</strong> en Baúl Digital.`)}
    ${warning(`Tu plan seguirá activo hasta el <strong>${periodEnd}</strong>. Después de esa fecha tu cuenta pasará automáticamente al plan gratuito.`)}
    ${p('Durante este período puedes seguir usando todas las funciones incluidas en tu plan actual. No se realizan reembolsos parciales por el tiempo restante.')}
    ${btn('Ir a mi Baúl', `${BASE_URL}/dashboard`)}
    ${p('Si cancelaste por error, puedes contratar un nuevo plan en cualquier momento desde la sección de <a href="${BASE_URL}/dashboard/pricing" style="color:#2563eb;">Planes</a>.')}
    ${p('¿Tienes comentarios sobre por qué cancelaste? Escríbenos a <a href="mailto:soporte@mibauldigital.com" style="color:#2563eb;">soporte@mibauldigital.com</a>.')}
  `);
}

export function deletionWarningHtml(opts: {
  fullName:     string;
  scheduledFor: string;
  daysRemaining: number;
}) {
  const { fullName, scheduledFor, daysRemaining } = opts;
  return layout(`
    ${h1('Solicitud de cierre de cuenta recibida')}
    ${p(`Hola <strong>${fullName}</strong>, hemos recibido tu solicitud para cerrar tu cuenta en Baúl Digital.`)}
    ${warning(`⚠️ Tu cuenta será eliminada definitivamente el <strong>${scheduledFor}</strong> (en ${daysRemaining} días). Después de esa fecha no podrás recuperar tus documentos.`)}
    ${p('Si cambiaste de opinión, puedes cancelar la solicitud en cualquier momento antes de esa fecha desde tu configuración.')}
    ${btn('Cancelar solicitud de cierre', `${BASE_URL}/dashboard/settings`, '#16a34a')}
    ${p('Si no solicitaste este cierre, contáctanos de inmediato en <a href="mailto:legal@mibauldigital.com" style="color:#2563eb;">legal@mibauldigital.com</a>.')}
  `);
}

export function deletionConfirmedHtml(opts: { fullName: string; email: string }) {
  const { fullName, email } = opts;
  return layout(`
    ${h1('Tu cuenta ha sido eliminada')}
    ${p(`Hola <strong>${fullName}</strong>, confirmamos que tu cuenta asociada a <strong>${email}</strong> ha sido eliminada definitivamente de Baúl Digital.`)}
    ${p('Todos tus documentos han sido borrados de nuestros servidores. En cumplimiento de la Ley 1581 de 2012, conservaremos únicamente los registros mínimos requeridos por obligación legal durante 5 años.')}
    ${p('Si en el futuro deseas volver a usar Baúl Digital, puedes crear una nueva cuenta en cualquier momento.')}
    ${btn('Crear nueva cuenta', `${BASE_URL}/register`)}
    ${p('Gracias por haber confiado en nosotros.')}
  `);
}

export function deletionCancelledHtml(opts: { fullName: string }) {
  const { fullName } = opts;
  return layout(`
    ${h1('Solicitud de cierre cancelada')}
    ${p(`Hola <strong>${fullName}</strong>, tu solicitud de cierre de cuenta ha sido cancelada exitosamente.`)}
    ${p('Tu cuenta sigue activa y todos tus documentos están disponibles como siempre.')}
    ${btn('Ir a mi Baúl', `${BASE_URL}/dashboard`)}
    ${p('Si tienes dudas o necesitas ayuda, escríbenos a <a href="mailto:legal@mibauldigital.com" style="color:#2563eb;">legal@mibauldigital.com</a>.')}
  `);
}

export function deletionReminderHtml(opts: {
  fullName:      string;
  scheduledFor:  string;
  daysRemaining: number;
}) {
  const { fullName, scheduledFor, daysRemaining } = opts;
  return layout(`
    ${h1('Recordatorio: tu cuenta será eliminada pronto')}
    ${p(`Hola <strong>${fullName}</strong>, te recordamos que solicitaste el cierre de tu cuenta en Baúl Digital.`)}
    ${warning(`⚠️ Faltan <strong>${daysRemaining} días</strong> para que tu cuenta sea eliminada definitivamente el <strong>${scheduledFor}</strong>.`)}
    ${p('Si aún no has descargado tus documentos, te recomendamos hacerlo antes de esa fecha desde tu configuración.')}
    ${btn('Cancelar cierre y conservar mi cuenta', `${BASE_URL}/dashboard/settings`, '#16a34a')}
    ${btn('Descargar mis documentos', `${BASE_URL}/dashboard/settings`, '#475569')}
  `);
}
