import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { getDatabaseClient } from '@/lib/database';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const isProduction = process.env.NEXT_PUBLIC_APP_ENV === 'production';
const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'supabase';

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (storageType === 'supabase' && isProduction) {
      return NextResponse.json({ error: 'Use Client SDK for Supabase' }, { status: 400 });
    }

    // MODO LOCAL
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const categoryId = formData.get('categoryId') as string | null;
    const expiryDate = formData.get('expiryDate') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Archivo no proporcionado.' }, { status: 400 });
    }

    // Basic file validation for local
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    const filePath = join(uploadDir, fileName);
    const storagePath = `/uploads/${fileName}`;

    const client = getDatabaseClient();

    // Check Quota
    const profileResult = await client.query(
      'SELECT storage_quota_bytes, storage_used_bytes FROM profiles WHERE id = $1',
      [session.user.id]
    );
    const profile = profileResult.rows[0];
    if (profile.storage_used_bytes + file.size > profile.storage_quota_bytes) {
      return NextResponse.json({ error: 'Cuota de almacenamiento excedida.' }, { status: 400 });
    }

    // Save File safely
    await writeFile(filePath, buffer);

    // Insert into DB
    const insertResult = await client.query(
      `INSERT INTO documents (
         user_id, category_id, file_name, file_size_bytes, file_type, storage_path, access_level, expiry_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        session.user.id,
        categoryId || null,
        file.name,
        file.size,
        file.type,
        storagePath,
        'private',
        expiryDate || null
      ]
    );

    const newDocument = insertResult.rows[0];

    // Update Quota via RPC (or Direct Query since we are raw pg)
    await client.query(
      'SELECT update_storage_used($1, $2::BIGINT)',
      [session.user.id, file.size]
    );

    return NextResponse.json({ success: true, document: newDocument });

  } catch (error: any) {
    console.error('File Upload API Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor al procesar el archivo.' }, { status: 500 });
  }
}
