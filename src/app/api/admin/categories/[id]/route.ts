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
    const allowed = ['name', 'description', 'icon', 'color_code', 'sort_order', 'is_active'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Sin campos a actualizar.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('default_categories_template')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar la categoría template.' }, { status: 500 });
    }

    void supabaseAdmin.from('audit_logs').insert({
      user_id: adminId, action: 'ADMIN_UPDATE_CATEGORY_TEMPLATE',
      resource_type: 'category_template', resource_id: params.id,
    });

    return NextResponse.json({ category: data });
  } catch (err) {
    console.error('[admin/categories/[id]] PATCH Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('default_categories_template')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: 'Error al eliminar la categoría template.' }, { status: 500 });
    }

    void supabaseAdmin.from('audit_logs').insert({
      user_id: adminId, action: 'ADMIN_DELETE_CATEGORY_TEMPLATE',
      resource_type: 'category_template', resource_id: params.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/categories/[id]] DELETE Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
