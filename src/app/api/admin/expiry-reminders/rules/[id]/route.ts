import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../../../_lib/verify-admin';

// PATCH — editar regla: label, is_active, sort_order
// Body: { label?: string, is_active?: boolean, sort_order?: number }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const id = params.id;
    if (!id) return NextResponse.json({ error: 'id requerido.' }, { status: 400 });

    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.label === 'string' && body.label.trim()) {
      updates.label = body.label.trim();
    }
    if (typeof body.is_active === 'boolean') {
      updates.is_active = body.is_active;
    }
    if (typeof body.sort_order === 'number') {
      updates.sort_order = body.sort_order;
    }

    const { data, error } = await supabaseAdmin
      .from('expiry_reminder_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Regla no encontrada.' }, { status: 404 });
      }
      console.error('[admin/expiry-reminders/rules/[id]] PATCH error:', error);
      return NextResponse.json({ error: 'Error al actualizar la regla.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, rule: data });
  } catch (err) {
    console.error('[admin/expiry-reminders/rules/[id]] PATCH Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

// DELETE — eliminar regla (cancela pendientes antes de borrar)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const id = params.id;
    if (!id) return NextResponse.json({ error: 'id requerido.' }, { status: 400 });

    // Obtener la regla para conocer days_before antes de eliminarla
    const { data: rule, error: fetchError } = await supabaseAdmin
      .from('expiry_reminder_rules')
      .select('id, days_before')
      .eq('id', id)
      .single();

    if (fetchError || !rule) {
      return NextResponse.json({ error: 'Regla no encontrada.' }, { status: 404 });
    }

    // Cancelar sus pendientes (el trigger ON DELETE SET NULL los dejaría huérfanos)
    await supabaseAdmin
      .from('document_expiry_emails')
      .update({ status: 'cancelled' })
      .eq('days_before', rule.days_before)
      .eq('status', 'pending');

    // Eliminar la regla (los registros sent/failed quedan con rule_id = NULL por ON DELETE SET NULL)
    const { error: deleteError } = await supabaseAdmin
      .from('expiry_reminder_rules')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[admin/expiry-reminders/rules/[id]] DELETE error:', deleteError);
      return NextResponse.json({ error: 'Error al eliminar la regla.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted_id: id });
  } catch (err) {
    console.error('[admin/expiry-reminders/rules/[id]] DELETE Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
