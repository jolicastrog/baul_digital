import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — ejecutado por Vercel Cron (diariamente a las 3am UTC)
// Header Authorization: Bearer CRON_SECRET requerido
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    // Obtener cuentas cuyo periodo de gracia venció
    const { data: pending, error: pendingError } = await supabaseAdmin
      .rpc('get_pending_account_deletions');

    if (pendingError) {
      console.error('[execute-deletions] get_pending error:', pendingError);
      return NextResponse.json({ error: 'Error al obtener solicitudes.' }, { status: 500 });
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    const results: Array<{ user_id: string; status: 'deleted' | 'error'; error?: string }> = [];

    for (const row of pending as Array<{ user_id: string; user_email: string }>) {
      try {
        const { data, error } = await supabaseAdmin
          .rpc('execute_account_deletion', {
            p_user_id:     row.user_id,
            p_executed_by: 'cron',
          });

        if (error || !(data as any)?.success) {
          results.push({ user_id: row.user_id, status: 'error', error: error?.message ?? (data as any)?.error });
          continue;
        }

        // Registrar email de confirmación de eliminación
        void supabaseAdmin.from('email_logs').insert({
          user_id:   null,
          recipient: row.user_email,
          template:  'deletion_confirmed',
          subject:   'Tu cuenta en Baúl Digital ha sido eliminada',
          metadata:  { executed_by: 'cron', user_id: row.user_id },
        });

        results.push({ user_id: row.user_id, status: 'deleted' });
      } catch (err: any) {
        results.push({ user_id: row.user_id, status: 'error', error: err.message });
      }
    }

    const deleted = results.filter(r => r.status === 'deleted').length;
    const errors  = results.filter(r => r.status === 'error').length;

    console.log(`[execute-deletions] processed=${results.length} deleted=${deleted} errors=${errors}`);

    return NextResponse.json({ success: true, processed: results.length, deleted, errors, results });
  } catch (err) {
    console.error('[execute-deletions] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
