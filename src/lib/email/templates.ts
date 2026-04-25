const BASE_URL = 'https://www.mibauldigital.com';

const layout = (content: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Baúl Digital</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <div style="width:64px;height:64px;background-color:#2563eb;border-radius:16px;display:inline-block;text-align:center;line-height:64px;font-size:32px;">&#128274;</div>
              <div style="margin-top:16px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Ba&uacute;l Digital</div>
              <div style="font-size:13px;color:#64748b;margin-top:4px;">mibauldigital.com</div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#1e293b;border-radius:20px;padding:40px 36px;border:1px solid rgba(255,255,255,0.06);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.8;">
                &copy; 2026 Ba&uacute;l Digital &nbsp;&middot;&nbsp;
                <a href="${BASE_URL}/privacidad" style="color:#475569;text-decoration:underline;">Privacidad</a>
                &nbsp;&middot;&nbsp;
                <a href="${BASE_URL}/terminos" style="color:#475569;text-decoration:underline;">T&eacute;rminos</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/* ── Helpers ─────────────────────────────────────────────── */
const h1 = (text: string) =>
  `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;text-align:center;">${text}</h1>`;

const subtitle = (text: string) =>
  `<p style="margin:0 0 28px;font-size:14px;color:#94a3b8;text-align:center;line-height:1.6;">${text}</p>`;

const p = (text: string) =>
  `<p style="margin:0 0 14px;font-size:14px;color:#94a3b8;line-height:1.6;">${text}</p>`;

const btn = (text: string, url: string, color = '#2563eb') =>
  `<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
    <tr>
      <td align="center">
        <a href="${url}" style="display:inline-block;background-color:${color};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.2px;">${text}</a>
      </td>
    </tr>
  </table>`;

const warning = (text: string) =>
  `<div style="background-color:#1c1917;border:1px solid #f59e0b;border-radius:10px;padding:14px 16px;margin:16px 0;font-size:13px;color:#fbbf24;line-height:1.5;">${text}</div>`;

const divider = () =>
  `<div style="border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;"></div>`;

/* ── Templates ───────────────────────────────────────────── */

export function subscriptionCancelledHtml(opts: {
  fullName:  string;
  planLabel: string;
  periodEnd: string;
}) {
  const { fullName, planLabel, periodEnd } = opts;
  return layout(`
    ${h1('Suscripción cancelada')}
    ${subtitle(`Hola <strong style="color:#e2e8f0;">${fullName}</strong>, hemos registrado la cancelación de tu plan <strong style="color:#e2e8f0;">${planLabel}</strong>.`)}
    ${warning(`Tu plan seguirá activo hasta el <strong>${periodEnd}</strong>. Después de esa fecha tu cuenta pasará automáticamente al plan gratuito.`)}
    ${p('Durante este período puedes seguir usando todas las funciones incluidas en tu plan actual. No se realizan reembolsos parciales por el tiempo restante.')}
    ${btn('Ir a mi Baúl', `${BASE_URL}/dashboard`)}
    ${divider()}
    ${p(`Si cancelaste por error, puedes contratar un nuevo plan en cualquier momento desde la sección de <a href="${BASE_URL}/dashboard/pricing" style="color:#3b82f6;">Planes</a>.`)}
    ${p(`¿Tienes comentarios sobre por qué cancelaste? Escríbenos a <a href="mailto:soporte@mibauldigital.com" style="color:#3b82f6;">soporte@mibauldigital.com</a>.`)}
  `);
}

export function deletionWarningHtml(opts: {
  fullName:      string;
  scheduledFor:  string;
  daysRemaining: number;
}) {
  const { fullName, scheduledFor, daysRemaining } = opts;
  return layout(`
    ${h1('Solicitud de cierre de cuenta recibida')}
    ${subtitle(`Hola <strong style="color:#e2e8f0;">${fullName}</strong>, hemos recibido tu solicitud para cerrar tu cuenta en Baúl Digital.`)}
    ${warning(`Tu cuenta será eliminada definitivamente el <strong>${scheduledFor}</strong> (en ${daysRemaining} días). Después de esa fecha no podrás recuperar tus documentos.`)}
    ${p('Si cambiaste de opinión, puedes cancelar la solicitud en cualquier momento antes de esa fecha desde tu configuración.')}
    ${btn('Cancelar solicitud de cierre', `${BASE_URL}/dashboard/settings`, '#16a34a')}
    ${divider()}
    ${p(`Si no solicitaste este cierre, contáctanos de inmediato en <a href="mailto:legal@mibauldigital.com" style="color:#3b82f6;">legal@mibauldigital.com</a>.`)}
  `);
}

export function deletionConfirmedHtml(opts: { fullName: string; email: string }) {
  const { fullName, email } = opts;
  return layout(`
    ${h1('Tu cuenta ha sido eliminada')}
    ${subtitle(`Hola <strong style="color:#e2e8f0;">${fullName}</strong>, confirmamos que tu cuenta asociada a <strong style="color:#e2e8f0;">${email}</strong> ha sido eliminada definitivamente.`)}
    ${p('Todos tus documentos han sido borrados de nuestros servidores. En cumplimiento de la Ley 1581 de 2012, conservaremos únicamente los registros mínimos requeridos por obligación legal durante 5 años.')}
    ${p('Si en el futuro deseas volver a usar Baúl Digital, puedes crear una nueva cuenta en cualquier momento.')}
    ${btn('Crear nueva cuenta', `${BASE_URL}/register`)}
    ${divider()}
    ${p('Gracias por haber confiado en nosotros.')}
  `);
}

export function deletionCancelledHtml(opts: { fullName: string }) {
  const { fullName } = opts;
  return layout(`
    ${h1('Solicitud de cierre cancelada')}
    ${subtitle(`Hola <strong style="color:#e2e8f0;">${fullName}</strong>, tu solicitud de cierre de cuenta ha sido cancelada exitosamente.`)}
    ${p('Tu cuenta sigue activa y todos tus documentos están disponibles como siempre.')}
    ${btn('Ir a mi Baúl', `${BASE_URL}/dashboard`)}
    ${divider()}
    ${p(`Si tienes dudas o necesitas ayuda, escríbenos a <a href="mailto:legal@mibauldigital.com" style="color:#3b82f6;">legal@mibauldigital.com</a>.`)}
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
    ${subtitle(`Hola <strong style="color:#e2e8f0;">${fullName}</strong>, te recordamos que solicitaste el cierre de tu cuenta en Baúl Digital.`)}
    ${warning(`Faltan <strong>${daysRemaining} días</strong> para que tu cuenta sea eliminada definitivamente el <strong>${scheduledFor}</strong>.`)}
    ${p('Si aún no has descargado tus documentos, te recomendamos hacerlo antes de esa fecha desde tu configuración.')}
    ${btn('Cancelar cierre y conservar mi cuenta', `${BASE_URL}/dashboard/settings`, '#16a34a')}
    ${btn('Descargar mis documentos', `${BASE_URL}/dashboard/settings`, '#334155')}
  `);
}
