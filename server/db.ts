import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isProduction = process.env.NODE_ENV === "production";

// Strip sslmode from connection string — pg conflicts when both
// connectionString sslmode and explicit ssl option are provided
const connectionString = process.env.DATABASE_URL!
  .replace(/[?&]sslmode=[^&]*/g, '')
  .replace(/[?&]ssl=[^&]*/g, '');

export const pool = new Pool({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

export const db = drizzle({ client: pool, schema });
