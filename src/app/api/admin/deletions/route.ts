import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../_lib/verify-admin';
import { sendEmail } from '@/lib/email/sendEmail';
import { deletionCancelledHtml } from '@/lib/email/templates';

// GET — lista solicitudes pendientes O usuarios eliminados
// ?tab=pending (default) | ?tab=deleted&search=...&limit=20&offset=0
export async function GET(request: NextRequest) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tab    = searchParams.get('tab') ?? 'pending';
    const search = searchParams.get('search') ?? undefined;
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    if (tab === 'deleted') {
      const { data, error } = await supabaseAdmin.rpc('admin_get_deleted_users', {
        p_search: search ?? null,
        p_limit:  limit,
        p_offset: offset,
      });

      if (error) {
        console.error('[admin/deletions] admin_get_deleted_users error:', error);
        return NextResponse.json({ error: 'Error al obtener usuarios eliminados.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, tab: 'deleted', rows: data ?? [] });
    }

    // tab === 'pending'
    const { data, error } = await supabaseAdmin.rpc('admin_get_pending_deletions');

    if (error) {
      console.error('[admin/deletions] admin_get_pending_deletions error:', error);
      return NextResponse.json({ error: 'Error al obtener solicitudes pendientes.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tab: 'pending', rows: data ?? [] });
  } catch (err) {
    console.error('[admin/deletions] GET Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

// DELETE — admin cancela una solicitud de baja pendiente
// Body: { request_id: UUID, admin_note?: string }
export async function DELETE(request: NextRequest) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { request_id, admin_note } = await request.json();
    if (!request_id) {
      return NextResponse.json({ error: 'request_id requerido' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('admin_cancel_user_deletion', {
      p_request_id: request_id,
      p_admin_note: admin_note ?? null,
    });

    if (error) {
      console.error('[admin/deletions] admin_cancel_user_deletion error:', error);
      return NextResponse.json({ error: 'Error al cancelar la solicitud.' }, { status: 500 });
    }

    const result = data as { success: boolean; error?: string; user_id?: string };

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    // Notificar al usuario por email
    if (result.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', result.user_id)
        .single();

      if (profile?.email) {
        await sendEmail({
          to:       profile.email,
          subject:  'Tu solicitud de cierre de cuenta ha sido cancelada — Baúl Digital',
          html:     deletionCancelledHtml({ fullName: profile.full_name ?? profile.email }),
          template: 'deletion_cancelled',
          userId:   result.user_id,
          metadata: { cancelled_by: 'admin' },
        });
      }
    }

    return NextResponse.json({ success: true, user_id: result.user_id });
  } catch (err) {
    console.error('[admin/deletions] DELETE Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
