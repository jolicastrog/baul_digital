import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../../_lib/verify-admin';

// GET — lista todas las reglas ordenadas
export async function GET() {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from('expiry_reminder_rules')
      .select('id, days_before, label, is_active, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('days_before', { ascending: true });

    if (error) {
      console.error('[admin/expiry-reminders/rules] GET error:', error);
      return NextResponse.json({ error: 'Error al obtener reglas.' }, { status: 500 });
    }

    return NextResponse.json({ rules: data ?? [] });
  } catch (err) {
    console.error('[admin/expiry-reminders/rules] GET Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

// POST — crear nueva regla
// Body: { days_before: number, label: string, is_active?: boolean, sort_order?: number }
export async function POST(request: NextRequest) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { days_before, label, is_active = true, sort_order = 0 } = await request.json();

    if (!days_before || typeof days_before !== 'number' || days_before <= 0) {
      return NextResponse.json({ error: 'days_before debe ser un número mayor a 0.' }, { status: 400 });
    }
    if (!label || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json({ error: 'label es requerido.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('expiry_reminder_rules')
      .insert({ days_before, label: label.trim(), is_active, sort_order })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Ya existe una regla para ${days_before} días antes.` }, { status: 409 });
      }
      console.error('[admin/expiry-reminders/rules] POST error:', error);
      return NextResponse.json({ error: 'Error al crear la regla.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, rule: data }, { status: 201 });
  } catch (err) {
    console.error('[admin/expiry-reminders/rules] POST Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
