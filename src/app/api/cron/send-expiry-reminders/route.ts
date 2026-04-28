import { NextResponse }        from 'next/server';
import { createClient }        from '@supabase/supabase-js';
import { sendEmail }           from '@/lib/email/sendEmail';
import { expiryReminderHtml }  from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — Vercel Cron 7:00 AM UTC (2:00 AM Colombia)
export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Verificar interruptor global
  const { data: settings } = await supabaseAdmin
    .from('expiry_reminder_settings')
    .select('reminders_enabled')
    .single();

  if (!settings?.reminders_enabled) {
    console.log('[expiry-reminders] Sistema desactivado por el admin.');
    return NextResponse.json({ success: true, skipped: 'disabled' });
  }

  // Obtener pendientes del día (lte captura uploads tardíos del día anterior)
  const today = new Date().toISOString().split('T')[0];
  const { data: pending, error: fetchError } = await supabaseAdmin
    .from('document_expiry_emails')
    .select(`
      id, days_before, document_id, user_id,
      documents ( file_name, expiry_date, expiry_note ),
      profiles  ( email, full_name, plan_type )
    `)
    .lte('scheduled_date', today)
    .eq('status', 'pending');

  if (fetchError) {
    console.error('[expiry-reminders] Error fetching pending:', fetchError);
    return NextResponse.json({ error: 'Error al obtener recordatorios pendientes.' }, { status: 500 });
  }

  if (!pending?.length) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  let sent = 0, skipped = 0, failed = 0;

  for (const row of pending) {
    const profile  = row.profiles  as { email: string; full_name: string | null; plan_type: string } | null;
    const document = row.documents as { file_name: string; expiry_date: string; expiry_note: string | null } | null;

    if (!profile || !document) {
      await supabaseAdmin
        .from('document_expiry_emails')
        .update({ status: 'skipped', error_message: 'Perfil o documento no encontrado' })
        .eq('id', row.id);
      skipped++;
      continue;
    }

    // Saltar si es plan free
    if (profile.plan_type === 'free') {
      await supabaseAdmin
        .from('document_expiry_emails')
        .update({ status: 'skipped' })
        .eq('id', row.id);
      skipped++;
      continue;
    }

    const expiryDate = new Date(document.expiry_date).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    try {
      await sendEmail({
        to:      profile.email,
        subject: `Tu documento "${document.file_name}" vence en ${row.days_before} día${row.days_before === 1 ? '' : 's'} — Baúl Digital`,
        html:    expiryReminderHtml({
          fullName:      profile.full_name ?? profile.email,
          documentName:  document.file_name,
          expiryDate,
          daysRemaining: row.days_before,
          expiryNote:    document.expiry_note ?? null,
        }),
        template: 'expiry_reminder',
        userId:   row.user_id,
        metadata: {
          document_id: row.document_id,
          days_before: row.days_before,
          expiry_date: document.expiry_date,
        },
      });

      await supabaseAdmin
        .from('document_expiry_emails')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id);

      sent++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      await supabaseAdmin
        .from('document_expiry_emails')
        .update({ status: 'failed', error_message: msg })
        .eq('id', row.id);
      failed++;
      console.error(`[expiry-reminders] failed for row ${row.id}:`, err);
    }
  }

  console.log(`[expiry-reminders] sent=${sent} skipped=${skipped} failed=${failed}`);
  return NextResponse.json({ success: true, sent, skipped, failed });
}
