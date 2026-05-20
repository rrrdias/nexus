import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || 'postgresql://admin:1213122@127.0.0.1:5432/core_db'

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update. In production, we use a standard solution.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined
  db: ReturnType<typeof drizzle<typeof schema>> | undefined
}

// Em desenvolvimento, limitamos o número de conexões para evitar "too many clients"
const conn = globalForDb.conn ?? postgres(connectionString, { 
  prepare: false,
  max: process.env.NODE_ENV === 'development' ? 5 : undefined,
  idle_timeout: 20,
  connect_timeout: 10
})

if (process.env.NODE_ENV !== 'production') globalForDb.conn = conn

export const db = globalForDb.db ?? drizzle(conn, { schema })
if (process.env.NODE_ENV !== 'production') globalForDb.db = db
