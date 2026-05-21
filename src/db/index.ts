import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update. In production, we use a standard solution.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined
  db: ReturnType<typeof drizzle<typeof schema>> | undefined
}

// Em desenvolvimento, aumentamos um pouco o limite mas mantemos controlado
const conn = globalForDb.conn ?? postgres(connectionString, { 
  prepare: false,
  max: process.env.NODE_ENV === 'development' ? 10 : undefined,
  idle_timeout: 30,
  connect_timeout: 15
})

if (process.env.NODE_ENV !== 'production') globalForDb.conn = conn

export const db = globalForDb.db ?? drizzle(conn, { schema })
if (process.env.NODE_ENV !== 'production') globalForDb.db = db
