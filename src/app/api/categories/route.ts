import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getAnonSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

function parseCategoryError(msg: string): string {
  if (msg.includes('PLAN_FREE_RESTRICTED'))     return 'El plan gratuito no permite crear categorías personalizadas. Actualiza tu plan.';
  if (msg.includes('CATEGORY_LIMIT_REACHED'))   return msg.split('CATEGORY_LIMIT_REACHED: ')[1] ?? 'Límite de categorías alcanzado.';
  if (msg.includes('already exists') || msg.includes('duplicate key'))
    return 'Ya tienes una categoría con ese nombre.';
  return 'Error al crear la categoría. Intenta de nuevo.';
}

// GET — listar categorías con conteo de documentos
export async function GET() {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: categories, error } = await supabaseAdmin
      .from('categories')
      .select('*, documents(id)')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (categories ?? []).map((c: any) => ({
      ...c,
      doc_count: c.documents?.length ?? 0,
      documents: undefined,
    }));

    const { data: planData } = await supabaseAdmin
      .from('profiles')
      .select('plan_type, plans!inner(max_categories)')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      success:        true,
      categories:     result,
      max_categories: (planData as any)?.plans?.max_categories ?? null,
      plan_type:      (planData as any)?.plan_type ?? 'free',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crear categoría personalizada
export async function POST(request: Request) {
  try {
    const supabase = getAnonSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { name, color_code, icon } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        user_id:    user.id,
        name:       name.trim(),
        color_code: color_code ?? '#1e40af',
        icon:       icon ?? 'folder',
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      const msg = parseCategoryError(error.message);
      const status = error.message.includes('PLAN_FREE_RESTRICTED') ? 403
        : error.message.includes('CATEGORY_LIMIT_REACHED') ? 403
        : 400;
      return NextResponse.json({ error: msg }, { status });
    }

    await supabaseAdmin.from('audit_logs').insert({
      user_id:       user.id,
      action:        'CATEGORY_CREATED',
      resource_type: 'category',
      resource_id:   data.id,
      details:       { name: data.name },
    });

    return NextResponse.json({ success: true, category: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
