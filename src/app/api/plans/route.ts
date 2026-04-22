import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Endpoint público — no requiere autenticación.
// La RLS de plans tiene: FOR SELECT USING (TRUE), accesible con anon key.
export const dynamic  = 'force-dynamic';
export const revalidate = 300; // cache 5 minutos

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('code, name, storage_bytes, max_documents, max_file_size_mb, price_monthly_cop, price_semiannual_cop, price_annual_cop, is_active')
      .eq('is_active', true)
      .order('price_monthly_cop', { ascending: true });

    if (error) {
      console.error('[api/plans] Error:', error);
      return NextResponse.json({ error: 'Error al obtener planes.' }, { status: 500 });
    }

    return NextResponse.json(
      { plans: data ?? [] },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
    );
  } catch (err) {
    console.error('[api/plans] Error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}
