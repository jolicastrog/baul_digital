import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../../../admin/_lib/verify-admin';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const allowed = [
      'name', 'storage_bytes', 'max_documents', 'max_file_size_mb',
      'price_monthly_cop', 'price_semiannual_cop', 'price_annual_cop', 'is_active',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Sin campos a actualizar.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('plans')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar el plan.' }, { status: 500 });
    }

    void supabaseAdmin.from('audit_logs').insert({
      user_id: adminId, action: 'ADMIN_UPDATE_PLAN',
      resource_type: 'plan', resource_id: params.id,
      details: { fields_updated: Object.keys(updates) },
    });

    return NextResponse.json({ plan: data });
  } catch (err) {
    console.error('[admin/plans/[id]] PATCH Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
