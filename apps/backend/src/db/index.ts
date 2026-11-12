import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://admin:1213122@127.0.0.1:5433/core_db';
const conn = postgres(connectionString);
export const db = drizzle(conn, { schema });
