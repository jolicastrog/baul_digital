import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../_lib/verify-admin';

export async function GET() {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.rpc('admin_get_stats');
    if (error) {
      console.error('[admin/stats] RPC error:', error);
      return NextResponse.json({ error: 'Error al obtener estadísticas.' }, { status: 500 });
    }

    return NextResponse.json({ stats: data });
  } catch (err) {
    console.error('[admin/stats] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
