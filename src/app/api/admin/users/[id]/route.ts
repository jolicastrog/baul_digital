import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../../../admin/_lib/verify-admin';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.rpc('admin_get_user_detail', {
      p_user_id: params.id,
    });

    if (error) {
      console.error('[admin/users/[id]] GET RPC error:', error);
      return NextResponse.json({ error: 'Error al obtener usuario.' }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    console.error('[admin/users/[id]] GET Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Un admin no puede modificarse a sí mismo desde estas acciones
    if (params.id === adminId) {
      return NextResponse.json(
        { error: 'No puedes modificar tu propio estado de administrador.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, value } = body as { action: 'toggle_active' | 'set_admin'; value: boolean };

    if (action === 'toggle_active') {
      const { error } = await supabaseAdmin.rpc('admin_toggle_user_active', {
        p_user_id: params.id,
        p_active:  value,
      });
      if (error) {
        console.error('[admin/users/[id]] toggle_active error:', error);
        return NextResponse.json({ error: 'Error al cambiar estado del usuario.' }, { status: 500 });
      }
    } else if (action === 'set_admin') {
      const { error } = await supabaseAdmin.rpc('admin_set_admin_flag', {
        p_user_id:  params.id,
        p_is_admin: value,
      });
      if (error) {
        console.error('[admin/users/[id]] set_admin error:', error);
        return NextResponse.json({ error: 'Error al cambiar rol de administrador.' }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
    }

    // Registrar acción en audit log
    void supabaseAdmin.from('audit_logs').insert({
      user_id:       adminId,
      action:        action === 'toggle_active' ? 'ADMIN_TOGGLE_USER_ACTIVE' : 'ADMIN_SET_ADMIN_FLAG',
      resource_type: 'profile',
      resource_id:   params.id,
      details:       { value },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/users/[id]] PATCH Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
