const { Client } = require('pg');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'baul_digital',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
};

async function main() {
  const client = new Client(config);

  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log('✅ PostgreSQL connection test passed');
    process.exit(0);
  } catch (error) {
    console.error('❌ PostgreSQL connection test failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
