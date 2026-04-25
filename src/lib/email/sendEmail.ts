import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = 'Baúl Digital <noreply@mibauldigital.com>';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type EmailTemplate =
  | 'deletion_warning'
  | 'deletion_confirmed'
  | 'deletion_cancelled'
  | 'deletion_reminder'
  | 'subscription_cancelled';

interface SendEmailOptions {
  to:        string;
  subject:   string;
  html:      string;
  template:  EmailTemplate;
  userId?:   string | null;
  metadata?: Record<string, unknown>;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const { to, subject, html, template, userId = null, metadata = {} } = opts;

  // Enviar
  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  });

  // Registrar en email_logs (éxito o error)
  void supabaseAdmin.from('email_logs').insert({
    user_id:  userId,
    recipient: to,
    template,
    subject,
    metadata: sendError
      ? { ...metadata, send_error: sendError.message }
      : metadata,
  });

  if (sendError) {
    console.error(`[sendEmail] template=${template} to=${to}`, sendError);
  }
}
