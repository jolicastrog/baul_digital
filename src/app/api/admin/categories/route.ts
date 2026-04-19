import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin } from '../../admin/_lib/verify-admin';

export async function GET() {
  try {
    const adminId = await verifyAdmin();
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('default_categories_template')
      .select('*')
      .order('sort_order');

    if (error) {
      return NextResponse.json({ error: 'Error al obtener categorías template.' }, { status: 500 });
    }

    return NextResponse.json({ categories: data ?? [] });
  } catch (err) {
    console.error('[admin/categories] GET Error:', err);
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
    const { name, description, icon, color_code, sort_order, is_active } = body;

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('default_categories_template')
      .insert({
        name:        name.trim(),
        description: description ?? null,
        icon:        icon        ?? 'folder',
        color_code:  color_code  ?? '#475569',
        sort_order:  sort_order  ?? 99,
        is_active:   is_active   ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Error al crear la categoría template.' }, { status: 500 });
    }

    void supabaseAdmin.from('audit_logs').insert({
      user_id: adminId, action: 'ADMIN_CREATE_CATEGORY_TEMPLATE',
      resource_type: 'category_template', resource_id: data.id,
    });

    return NextResponse.json({ category: data }, { status: 201 });
  } catch (err) {
    console.error('[admin/categories] POST Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
