import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — ejecutado por Vercel Cron (diariamente a la 1am UTC)
// Header Authorization: Bearer CRON_SECRET requerido
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    // Llama a la función de BD que:
    // 1. Marca status='expired', is_active=FALSE donde current_period_end < NOW()
    // 2. Inserta registro en subscription_events
    // 3. El trigger sync_plan_from_subscription degrada profiles.plan_type a 'free'
    const { data: expired, error } = await supabaseAdmin
      .rpc('expire_subscriptions');

    if (error) {
      console.error('[expire-subscriptions] RPC error:', error);
      return NextResponse.json({ error: 'Error al expirar suscripciones.' }, { status: 500 });
    }

    console.log(`[expire-subscriptions] expiradas: ${expired}`);
    return NextResponse.json({ success: true, expired });
  } catch (err) {
    console.error('[expire-subscriptions] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
