import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure PostgreSQL pool supporting both external connection strings and individual params
export const pool = new Pool(
  config.db.connectionString
    ? {
        connectionString: config.db.connectionString,
        ssl: config.db.ssl,
        max: config.db.max,
        idleTimeoutMillis: config.db.idleTimeoutMillis,
        connectionTimeoutMillis: config.db.connectionTimeoutMillis,
      }
    : {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        ssl: config.db.ssl,
        max: config.db.max,
        idleTimeoutMillis: config.db.idleTimeoutMillis,
        connectionTimeoutMillis: config.db.connectionTimeoutMillis,
      }
);

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]:', err.message);
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (config.nodeEnv === 'development' && duration > 200) {
    console.log('[PostgreSQL Slow Query]', { text, duration, rows: res.rowCount });
  }
  return res;
}

export async function initDatabase(): Promise<void> {
  try {
    const targetInfo = config.db.connectionString
      ? config.db.connectionString.replace(/:[^:@]+@/, ':****@')
      : `${config.db.host}:${config.db.port}/${config.db.database}`;
    console.log(`[Database Target]: ${targetInfo} (SSL: ${config.db.ssl ? 'enabled' : 'disabled'})`);
    
    // Verify connection by querying database version
    const dbVer = await pool.query('SELECT version();');
    console.log(`✓ PostgreSQL database connection verified: ${dbVer.rows[0].version.split(' ')[0]}`);

    // Log current Alembic revision if present
    try {
      const alembicRes = await pool.query('SELECT version_num FROM alembic_version;');
      if (alembicRes.rows.length > 0) {
        console.log(`📦 Alembic Migration Version: ${alembicRes.rows[0].version_num}`);
      }
    } catch {
      // If alembic_version table doesn't exist yet, it will be initialized by Alembic runner
    }
  } catch (err: any) {
    console.error('✗ Failed to verify database connection:', err.message || err);
    throw err;
  }
}
