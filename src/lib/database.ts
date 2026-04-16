// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { Database } from '@/types/database';

// ============================================================================
// CONFIGURACIÓN DE BASE DE DATOS
// ============================================================================

const isProduction = process.env.NEXT_PUBLIC_APP_ENV === 'production';
const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'supabase';

// ============================================================================
// CLIENTE SUPABASE (PRODUCCIÓN)
// ============================================================================

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    supabaseClient = createClient<Database>(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

// ============================================================================
// CLIENTE POSTGRESQL LOCAL (DESARROLLO)
// ============================================================================

let postgresPool: Pool | null = null;

export function getPostgresClient() {
  if (!postgresPool) {
    postgresPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'baul_digital',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
    });
  }
  return postgresPool;
}

// ============================================================================
// CLIENTE UNIFICADO (AUTOMÁTICO)
// ============================================================================

/**
 * Retorna el cliente de base de datos apropiado según el entorno
 * - Desarrollo: PostgreSQL local
 * - Producción: Supabase
 */
export function getDatabaseClient() {
  if (storageType === 'local' || !isProduction) {
    return getPostgresClient();
  }
  return getSupabaseClient();
}

// ============================================================================
// FUNCIONES DE CONEXIÓN
// ============================================================================

export async function connectDatabase() {
  if (storageType === 'local' || !isProduction) {
    const client = getPostgresClient();
    try {
      await client.connect();
      console.log('✅ Connected to local PostgreSQL');
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL:', error);
      throw error;
    }
  } else {
    // Supabase no necesita conexión explícita
    console.log('✅ Using Supabase client');
  }
}

export async function disconnectDatabase() {
  if (storageType === 'local' || !isProduction) {
    const client = getPostgresClient();
    try {
      await client.end();
      console.log('🔌 Disconnected from PostgreSQL');
    } catch (error) {
      console.error('❌ Error disconnecting from PostgreSQL:', error);
    }
  }
}

// ============================================================================
// FUNCIONES DE UTILIDAD PARA DESARROLLO
// ============================================================================

/**
 * Ejecuta una consulta SQL (solo para desarrollo local)
 */
export async function executeQuery(query: string, params: any[] = []) {
  if (storageType === 'local' || !isProduction) {
    const client = getPostgresClient();
    try {
      const result = await client.query(query, params);
      return result;
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  } else {
    throw new Error('executeQuery is only available in local development mode');
  }
}

/**
 * Verifica la conexión a la base de datos
 */
export async function testConnection() {
  try {
    if (storageType === 'local' || !isProduction) {
      const client = getPostgresClient();
      await client.query('SELECT 1');
      console.log('✅ PostgreSQL connection test passed');
      return true;
    } else {
      const client = getSupabaseClient();
      const { data, error } = await client.from('profiles').select('count').limit(1);
      if (error) throw error;
      console.log('✅ Supabase connection test passed');
      return true;
    }
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}
