import pg from 'pg';
import { config } from './config.js';

// Neon connection strings carry ?sslmode=require, which pg honours.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Neon computes may be suspended; allow time for a cold start.
  connectionTimeoutMillis: 15_000,
});

pool.on('error', (err) => console.error('Unexpected pg pool error:', err.message));

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
