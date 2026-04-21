import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email/sendEmail';
import { deletionReminderHtml } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — ejecutado por Vercel Cron (diariamente a las 4am UTC)
// Header Authorization: Bearer CRON_SECRET requerido
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { data: candidates, error } = await supabaseAdmin
      .rpc('get_deletion_reminder_candidates');

    if (error) {
      console.error('[send-reminders] RPC error:', error);
      return NextResponse.json({ error: 'Error al obtener candidatos.' }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const results: Array<{ user_id: string; status: 'sent' | 'error'; error?: string }> = [];

    for (const row of candidates as Array<{
      user_id:       string;
      user_email:    string;
      full_name:     string;
      scheduled_for: string;
      days_remaining: number;
    }>) {
      try {
        const scheduledFor = new Date(row.scheduled_for).toLocaleDateString('es-CO', {
          day: 'numeric', month: 'long', year: 'numeric',
        });

        await sendEmail({
          to:       row.user_email,
          subject:  `Recordatorio: tu cuenta será eliminada en ${row.days_remaining} días — Baúl Digital`,
          html:     deletionReminderHtml({
            fullName:      row.full_name ?? row.user_email,
            scheduledFor,
            daysRemaining: row.days_remaining,
          }),
          template: 'deletion_reminder',
          userId:   row.user_id,
          metadata: { scheduled_for: row.scheduled_for, days_remaining: row.days_remaining },
        });

        results.push({ user_id: row.user_id, status: 'sent' });
      } catch (err: any) {
        results.push({ user_id: row.user_id, status: 'error', error: err.message });
      }
    }

    const sent   = results.filter(r => r.status === 'sent').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(`[send-reminders] processed=${results.length} sent=${sent} errors=${errors}`);

    return NextResponse.json({ success: true, processed: results.length, sent, errors, results });
  } catch (err) {
    console.error('[send-reminders] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
