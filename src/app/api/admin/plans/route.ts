import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../../admin/_lib/verify-admin';

export async function GET() {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('plans')
      .select('*')
      .order('price_monthly_cop');

    if (error) {
      return NextResponse.json({ error: 'Error al obtener planes.' }, { status: 500 });
    }

    return NextResponse.json({ plans: data ?? [] });
  } catch (err) {
    console.error('[admin/plans] GET Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const {
      code, name, storage_bytes, max_documents, max_file_size_mb,
      price_monthly_cop, price_semiannual_cop, price_annual_cop, is_active,
    } = body;

    if (!code || !name || !storage_bytes || !max_file_size_mb) {
      return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('plans')
      .insert({
        code, name, storage_bytes,
        max_documents:        max_documents        ?? null,
        max_file_size_mb:     max_file_size_mb,
        price_monthly_cop:    price_monthly_cop    ?? 0,
        price_semiannual_cop: price_semiannual_cop ?? 0,
        price_annual_cop:     price_annual_cop     ?? 0,
        is_active:            is_active            ?? true,
      })
      .select()
      .single();

    if (error) {
      const msg = error.code === '23505' ? 'Ya existe un plan con ese código.' : 'Error al crear el plan.';
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    void supabaseAdmin.from('audit_logs').insert({
      user_id: adminId, action: 'ADMIN_CREATE_PLAN',
      resource_type: 'plan', resource_id: data.id,
    });

    return NextResponse.json({ plan: data }, { status: 201 });
  } catch (err) {
    console.error('[admin/plans] POST Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
