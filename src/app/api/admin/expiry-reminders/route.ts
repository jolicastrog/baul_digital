import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../_lib/verify-admin';

// GET — estado completo: toggle global + lista de reglas
export async function GET() {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const [settingsRes, rulesRes] = await Promise.all([
      supabaseAdmin
        .from('expiry_reminder_settings')
        .select('reminders_enabled')
        .single(),
      supabaseAdmin
        .from('expiry_reminder_rules')
        .select('id, days_before, label, is_active, sort_order, created_at, updated_at')
        .order('sort_order', { ascending: true })
        .order('days_before', { ascending: true }),
    ]);

    if (settingsRes.error) {
      console.error('[admin/expiry-reminders] GET settings error:', settingsRes.error);
      return NextResponse.json({ error: 'Error al obtener configuración.' }, { status: 500 });
    }
    if (rulesRes.error) {
      console.error('[admin/expiry-reminders] GET rules error:', rulesRes.error);
      return NextResponse.json({ error: 'Error al obtener reglas.' }, { status: 500 });
    }

    return NextResponse.json({
      reminders_enabled: settingsRes.data?.reminders_enabled ?? true,
      rules:             rulesRes.data ?? [],
    });
  } catch (err) {
    console.error('[admin/expiry-reminders] GET Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

// PATCH — activar o desactivar el sistema globalmente
// Body: { reminders_enabled: boolean }
export async function PATCH(request: NextRequest) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { reminders_enabled } = await request.json();
    if (typeof reminders_enabled !== 'boolean') {
      return NextResponse.json({ error: 'reminders_enabled debe ser boolean.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('expiry_reminder_settings')
      .update({ reminders_enabled, updated_at: new Date().toISOString(), updated_by: adminId })
      .not('id', 'is', null); // actualiza la única fila del singleton

    if (error) {
      console.error('[admin/expiry-reminders] PATCH error:', error);
      return NextResponse.json({ error: 'Error al actualizar configuración.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, reminders_enabled });
  } catch (err) {
    console.error('[admin/expiry-reminders] PATCH Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
