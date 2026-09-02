import { Provider } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DB_CONNECTION = 'DB_CONNECTION';

export const DbProvider: Provider = {
  provide: DB_CONNECTION,
  useFactory: () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const maxConnections = process.env.DB_MAX_CONNECTIONS
      ? parseInt(process.env.DB_MAX_CONNECTIONS, 10)
      : process.env.NODE_ENV === 'development' ? 10 : 25;

    const conn = postgres(connectionString, {
      prepare: false,
      max: maxConnections,
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 30, // 30 minutes connection recycling
      onnotice: () => {}, // Suppress routine server notices from polluting logs
    });

    return drizzle(conn, { schema });
  },
};
