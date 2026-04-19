import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — tipos de documento activos (público, usado en el formulario de registro)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('document_types')
    .select('code, name, description, min_age_years, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ types: data ?? [] });
}
