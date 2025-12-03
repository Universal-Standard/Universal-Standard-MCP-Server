/**
 * Database Connection
 * PostgreSQL connection using Neon serverless driver with Drizzle ORM
 */
const { Pool, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const ws = require('ws');
const schema = require('../shared/schema');

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is required. Please provision a PostgreSQL database.'
  );
}

const poolConfig = {
  connectionString: DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  const logger = require('../src/utils/logger');
  logger.error('Unexpected database pool error', { error: err.message });
});

const db = drizzle({ client: pool, schema });

/**
 * Check database connectivity
 * @returns {Promise<boolean>}
 */
async function checkConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error.message);
    return false;
  }
}

/**
 * Gracefully close the database pool
 * @returns {Promise<void>}
 */
async function closePool() {
  await pool.end();
}

module.exports = { 
  pool, 
  db,
  checkConnection,
  closePool,
};
