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

    const conn = postgres(connectionString, {
      prepare: false,
      max: process.env.NODE_ENV === 'development' ? 10 : undefined,
      idle_timeout: 30,
      connect_timeout: 15,
    });

    return drizzle(conn, { schema });
  },
};
