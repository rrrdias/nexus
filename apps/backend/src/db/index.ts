import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const conn = postgres(connectionString);
export const db = drizzle(conn, { schema });
