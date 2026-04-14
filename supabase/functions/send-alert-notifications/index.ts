/**
 * Supabase Edge Function: Send Alert Notifications
 * 
 * Ejecuta: Diariamente a las 09:00 AM
 * Función: Envía emails y notificaciones push para documentos por vencer
 * 
 * Setup:
 * 1. Subir a Supabase: supabase functions deploy send-alert-notifications
 * 2. Configurar cron en Supabase: 0 9 * * * (9 AM diarios)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY") || "";
const sendgridFromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// INTERFACES
// ============================================================================

interface Alert {
  id: string;
  user_id: string;
  document_id: string;
  document_name: string;
  expiry_date: string;
  alert_days_before: number;
  alert_sent: boolean;
  notify_email: boolean;
  notify_push: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Calcula días entre dos fechas
 */
function daysUntilDate(dateString: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiryDate = new Date(dateString);
  expiryDate.setHours(0, 0, 0, 0);

  const timeDifference = expiryDate.getTime() - today.getTime();
  return Math.ceil(timeDifference / (1000 * 3600 * 24));
}

/**
 * Envía email usando SendGrid API
 */
async function sendEmail(
  toEmail: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: toEmail }],
            subject: subject,
          },
        ],
        from: {
          email: sendgridFromEmail,
          name: "Baúl Digital",
        },
        content: [
          {
            type: "text/html",
            value: htmlContent,
          },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

/**
 * Genera HTML del email de alerta
 */
function generateAlertEmailHTML(
  userName: string,
  documentName: string,
  daysRemaining: number,
  expiryDate: string
): string {
  const urgency = daysRemaining <= 7 ? "URGENTE" : "Próximo Vencimiento";
  const urgencyColor = daysRemaining <= 7 ? "#ef4444" : "#f59e0b";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e40af 0%, #059669 100%); padding: 30px; color: white; text-align: center; border-radius: 12px 12px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-bottom: none; }
          .alert-box { background: #fef2f2; border-left: 4px solid ${urgencyColor}; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .alert-label { color: ${urgencyColor}; font-weight: bold; font-size: 12px; text-transform: uppercase; }
          .document-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .document-name { font-size: 18px; font-weight: bold; color: #1e293b; margin: 0; }
          .expiry-date { color: #64748b; font-size: 14px; margin: 5px 0 0 0; }
          .cta-button { background: #1e40af; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; display: inline-block; margin-top: 20px; font-weight: 600; }
          .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Alerta de Vencimiento</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${userName}</strong>,</p>
            
            <div class="alert-box">
              <div class="alert-label">${urgency}</div>
              <p>Uno de tus documentos está próximo a vencer.</p>
            </div>

            <div class="document-info">
              <p class="document-name">${documentName}</p>
              <p class="expiry-date">
                Vence el: <strong>${new Date(expiryDate).toLocaleDateString("es-CO")}</strong>
                <br>Faltan: <strong>${daysRemaining} días</strong>
              </p>
            </div>

            <p>Te recomendamos renovar o reemplazar este documento cuanto antes para evitar inconvenientes.</p>

            <a href="https://www.bauldigital.co/documents" class="cta-button">
              Ver Documento
            </a>

            <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
              Estas notificaciones son automáticas. Si deseas ajustar la frecuencia, ve a tu sección de Alertas.
            </p>
          </div>
          <div class="footer">
            <p>© 2026 Baúl Digital - Gestión Inteligente de Documentos</p>
            <p>Privacidad garantizada según Ley 1581 (HABEAS DATA)</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Envía notificación push (para futuros clientes PWA)
 */
async function sendPushNotification(
  userId: string,
  title: string,
  body: string
): Promise<boolean> {
  try {
    // TODO: Integrar con servicio de push notifications
    // Por ahora, solo registramos que se intento enviar
    console.log(`Push notification queued for user ${userId}: ${title}`);
    return true;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

serve(async (_req) => {
  try {
    console.log("Starting alert notification processing...");

    // 1. Obtener todas las alertas pendientes
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select("*")
      .eq("alert_sent", false)
      .eq("is_dismissed", false);

    if (alertsError) {
      console.error("Error fetching alerts:", alertsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch alerts" }),
        { status: 500 }
      );
    }

    if (!alerts || alerts.length === 0) {
      console.log("No pending alerts to process");
      return new Response(
        JSON.stringify({ message: "No alerts to process", processed: 0 }),
        { status: 200 }
      );
    }

    console.log(`Processing ${alerts.length} alerts...`);

    // 2. Procesar cada alerta
    let successCount = 0;
    let failureCount = 0;

    for (const alert of alerts) {
      const daysRemaining = daysUntilDate(alert.expiry_date);

      // Si aún no llega la fecha de alerta, saltar
      if (daysRemaining > alert.alert_days_before) {
        console.log(
          `Alert for ${alert.document_name} not yet due (${daysRemaining} days remaining)`
        );
        continue;
      }

      try {
        // 3. Obtener datos del usuario
        const { data: user, error: userError } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", alert.user_id)
          .single();

        if (userError || !user) {
          console.error(`User not found for alert ${alert.id}`);
          failureCount++;
          continue;
        }

        // 4. Enviar email si está habilitado
        if (alert.notify_email) {
          const emailHtml = generateAlertEmailHTML(
            user.full_name || user.email,
            alert.document_name,
            daysRemaining,
            alert.expiry_date
          );

          const emailSent = await sendEmail(
            user.email,
            `Alerta: ${alert.document_name} vence en ${daysRemaining} días`,
            emailHtml
          );

          if (!emailSent) {
            console.error(
              `Failed to send email for alert ${alert.id} to ${user.email}`
            );
            failureCount++;
            continue;
          }
        }

        // 5. Enviar notificación push si está habilitada
        if (alert.notify_push) {
          await sendPushNotification(
            user.id,
            "Documento próximo a vencer",
            `${alert.document_name} vence en ${daysRemaining} días`
          );
        }

        // 6. Marcar alerta como enviada
        const { error: updateError } = await supabase
          .from("alerts")
          .update({
            alert_sent: true,
            alert_sent_at: new Date().toISOString(),
          })
          .eq("id", alert.id);

        if (updateError) {
          console.error(`Failed to update alert status for ${alert.id}`);
          failureCount++;
        } else {
          successCount++;
          console.log(`Successfully processed alert for ${alert.document_name}`);
        }
      } catch (error) {
        console.error(`Error processing alert ${alert.id}:`, error);
        failureCount++;
      }
    }

    // 7. Log de ejecución
    const executionLog = {
      timestamp: new Date().toISOString(),
      total_alerts: alerts.length,
      processed: successCount + failureCount,
      success: successCount,
      failed: failureCount,
    };

    console.log(`Execution summary:`, executionLog);

    return new Response(JSON.stringify(executionLog), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error in alert notification function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
});
