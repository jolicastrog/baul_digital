import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — ejecutado por Vercel Cron (anualmente el 1 enero a las 2am UTC)
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('purge_expired_archives');

    if (error) {
      console.error('[purge-archives] RPC error:', error);
      return NextResponse.json({ error: 'Error al purgar archivos.' }, { status: 500 });
    }

    const result = data as { success: boolean; deleted: number; purged_at: string };
    console.log(`[purge-archives] deleted=${result.deleted} at=${result.purged_at}`);

    return NextResponse.json({ success: true, deleted: result.deleted, purged_at: result.purged_at });
  } catch (err) {
    console.error('[purge-archives] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
