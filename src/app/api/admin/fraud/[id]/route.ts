import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../../../admin/_lib/verify-admin';

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.rpc('admin_mark_fraud_reviewed', {
      p_alert_id: params.id,
    });

    if (error) {
      console.error('[admin/fraud/[id]] RPC error:', error);
      return NextResponse.json({ error: 'Error al marcar alerta como revisada.' }, { status: 500 });
    }

    void supabaseAdmin.from('audit_logs').insert({
      user_id: adminId, action: 'ADMIN_MARK_FRAUD_REVIEWED',
      resource_type: 'fraud_alert', resource_id: params.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/fraud/[id]] PATCH Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
