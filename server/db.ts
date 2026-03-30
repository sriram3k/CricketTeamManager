import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

const rawUrl = process.env.DATABASE_URL;

if (!rawUrl || !rawUrl.match(/^postgre(s|sql):\/\//)) {
  throw new Error(
    `DATABASE_URL must be a valid PostgreSQL connection string (got: "${rawUrl}"). ` +
    `Did you forget to set it in your environment?`
  );
}

const isProduction = process.env.NODE_ENV === "production";

// Strip sslmode from connection string — pg conflicts when both
// connectionString sslmode and explicit ssl option are provided
const connectionString = rawUrl
  .replace(/[?&]sslmode=[^&]*/g, '')
  .replace(/[?&]ssl=[^&]*/g, '');

export const pool = new Pool({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// Set search_path on every new connection so all queries find tables
// in the crickiq schema (avoids public schema permission issues on PG15)
pool.on('connect', (client) => {
  client.query('SET search_path TO crickiq, public').catch(() => {});
});

export const db = drizzle({ client: pool, schema });
