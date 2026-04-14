#!/usr/bin/env node

/**
 * Script de migración para PostgreSQL local
 * Ejecuta las migraciones de Supabase en una base de datos PostgreSQL local
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Configuración de conexión a PostgreSQL local
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'baul_digital',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
};

async function runMigrations() {
  const client = new Client(config);

  try {
    console.log('🔄 Conectando a PostgreSQL local...');
    await client.connect();
    console.log('✅ Conexión exitosa');

    // Leer archivo de migración local
    const migrationPath = path.join(__dirname, 'init_local_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Ejecutando migración inicial...');

    // Ejecutar la migración
    await client.query(migrationSQL);

    console.log('✅ Migración completada exitosamente');

    // Verificar que las tablas se crearon
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('📋 Tablas creadas:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexión cerrada');
  }
}

async function resetDatabase() {
  const client = new Client(config);

  try {
    console.log('🗑️  Reseteando base de datos...');
    await client.connect();

    // Deshabilitar triggers y constraints temporalmente
    await client.query(`
      DO $$
      DECLARE
          r RECORD;
      BEGIN
          -- Deshabilitar triggers
          FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
              EXECUTE 'ALTER TABLE ' || r.tablename || ' DISABLE TRIGGER ALL;';
          END LOOP;

          -- Deshabilitar constraints
          FOR r IN SELECT conname, conrelid::regclass AS table_name
                   FROM pg_constraint
                   WHERE contype IN ('f', 'c', 'u')
                   AND connamespace = 'public'::regnamespace LOOP
              EXECUTE 'ALTER TABLE ' || r.table_name || ' DROP CONSTRAINT IF EXISTS ' || r.conname || ';';
          END LOOP;
      END;
      $$;
    `);

    // Eliminar todas las tablas
    await client.query(`
      DO $$
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
              EXECUTE 'DROP TABLE IF EXISTS ' || r.tablename || ' CASCADE;';
          END LOOP;
      END;
      $$;
    `);

    console.log('✅ Base de datos reseteada');

  } catch (error) {
    console.error('❌ Error reseteando base de datos:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function seedDatabase() {
  console.log('🌱 Los datos de prueba ya están incluidos en el esquema local');
  console.log('📧 Usuario de prueba: test@bauldigital.local');
  console.log('🔑 Cédula: 1234567890');
  console.log('ℹ️  Para más datos de prueba, ejecuta manualmente en PgAdmin');
}

// Función principal
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'migrate':
      await runMigrations();
      break;
    case 'reset':
      await resetDatabase();
      break;
    case 'seed':
      await seedDatabase();
      break;
    case 'fresh':
      await resetDatabase();
      await runMigrations();
      console.log('✅ Base de datos lista con datos de prueba incluidos');
      break;
    default:
      console.log('📖 Uso:');
      console.log('  npm run db:migrate    - Ejecutar migraciones');
      console.log('  npm run db:reset      - Resetear base de datos');
      console.log('  npm run db:seed       - Info sobre datos de prueba (ya incluidos)');
      console.log('  npm run db:fresh      - Reset + migrate (con datos de prueba)');
      break;
  }
}

main().catch(console.error);
