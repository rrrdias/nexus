import { db } from './index';
import { sql } from 'drizzle-orm';

async function migratePasswordReset() {
  console.log('🚀 Criando tabela e índices de password_reset_tokens...');
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "email" text NOT NULL,
        "token" text NOT NULL UNIQUE,
        "expires_at" timestamp with time zone NOT NULL,
        "used_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_pwd_reset_token" ON "password_reset_tokens" ("token");
      CREATE INDEX IF NOT EXISTS "idx_pwd_reset_user" ON "password_reset_tokens" ("user_id");
      CREATE INDEX IF NOT EXISTS "idx_pwd_reset_email" ON "password_reset_tokens" ("email");
    `);
    console.log('✅ Tabela password_reset_tokens criada com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração de password_reset_tokens:', err);
    process.exit(1);
  }
}

migratePasswordReset();
