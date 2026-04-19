import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../../admin/_lib/verify-admin';

export async function GET(request: Request) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '20'), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'),  0);

    const { data, error } = await supabaseAdmin.rpc('admin_get_users', {
      p_search: search ?? null,
      p_limit:  limit,
      p_offset: offset,
    });

    if (error) {
      console.error('[admin/users] RPC error:', error);
      return NextResponse.json({ error: 'Error al obtener usuarios.' }, { status: 500 });
    }

    const total = (data as any[])?.[0]?.total_count ?? 0;
    return NextResponse.json({ users: data ?? [], total });
  } catch (err) {
    console.error('[admin/users] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
