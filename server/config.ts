import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const isSsl =
  process.env.DB_SSL === 'true' ||
  (connectionString && (connectionString.includes('sslmode=require') || connectionString.includes('neon.tech') || connectionString.includes('supabase.co') || connectionString.includes('render.com') || connectionString.includes('railway.app')));

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'worklog-super-secret-key-change-in-production-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: 'worklog_session',
  db: {
    connectionString: connectionString || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'worklog',
    ssl: isSsl ? { rejectUnauthorized: false } : undefined,
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  }
};
