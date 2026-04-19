import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../../../admin/_lib/verify-admin';

export async function PATCH(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const allowed = ['name', 'description', 'min_age_years', 'is_active', 'sort_order'];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await supabaseAdmin
      .from('document_types')
      .update(updates)
      .eq('code', params.code)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar el tipo de documento.' }, { status: 500 });
    }

    void supabaseAdmin.from('audit_logs').insert({
      user_id: adminId, action: 'ADMIN_UPDATE_DOCUMENT_TYPE',
      resource_type: 'document_type', details: { code: params.code, updates },
    });

    return NextResponse.json({ type: data });
  } catch (err) {
    console.error('[admin/document-types/[code]] PATCH Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
