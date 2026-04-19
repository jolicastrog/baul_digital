import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../../admin/_lib/verify-admin';

export async function GET(request: Request) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId       = searchParams.get('user_id')       || undefined;
    const resourceType = searchParams.get('resource_type') || undefined;
    const action       = searchParams.get('action')        || undefined;
    const limit        = Math.min(parseInt(searchParams.get('limit')  || '50'), 200);
    const offset       = Math.max(parseInt(searchParams.get('offset') || '0'),  0);

    const { data, error } = await supabaseAdmin.rpc('admin_get_audit_logs', {
      p_limit:         limit,
      p_offset:        offset,
      p_user_id:       userId        ?? null,
      p_resource_type: resourceType  ?? null,
      p_action:        action        ?? null,
    });

    if (error) {
      console.error('[admin/audit] RPC error:', error);
      return NextResponse.json({ error: 'Error al obtener logs.' }, { status: 500 });
    }

    const total = (data as any[])?.[0]?.total_count ?? 0;
    return NextResponse.json({ logs: data ?? [], total });
  } catch (err) {
    console.error('[admin/audit] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
