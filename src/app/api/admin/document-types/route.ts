import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../../admin/_lib/verify-admin';

export async function GET() {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('document_types')
      .select('*')
      .order('sort_order');

    if (error) {
      return NextResponse.json({ error: 'Error al obtener tipos de documento.' }, { status: 500 });
    }

    return NextResponse.json({ types: data ?? [] });
  } catch (err) {
    console.error('[admin/document-types] GET Error:', err);
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
    const { code, name, description, min_age_years, is_active, sort_order } = body;

    if (!code || !name) {
      return NextResponse.json({ error: 'Faltan campos requeridos (code, name).' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('document_types')
      .insert({
        code:          code.trim().toUpperCase(),
        name:          name.trim(),
        description:   description   ?? null,
        min_age_years: min_age_years ?? null,
        is_active:     is_active     ?? true,
        sort_order:    sort_order    ?? 99,
      })
      .select()
      .single();

    if (error) {
      const msg = error.code === '23505' ? 'Ya existe un tipo con ese código.' : 'Error al crear el tipo de documento.';
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    void supabaseAdmin.from('audit_logs').insert({
      user_id: adminId, action: 'ADMIN_CREATE_DOCUMENT_TYPE',
      resource_type: 'document_type', details: { code: data.code },
    });

    return NextResponse.json({ type: data }, { status: 201 });
  } catch (err) {
    console.error('[admin/document-types] POST Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
