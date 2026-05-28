import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Carrega as variáveis de ambiente
dotenv.config({ path: resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL não encontrada no .env!");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function fixDatabase() {
  console.log("Iniciando correção do banco de dados para sincronização do Moodle...");

  try {
    // 1. Apagar todos os dados de ava_grades_report (eles serão baixados novamente do Moodle sem perda de informações)
    console.log("1. Limpando tabela ava_grades_report para remover duplicatas corrompidas...");
    await client`TRUNCATE TABLE ava_grades_report RESTART IDENTITY CASCADE;`;
    console.log("Tabela ava_grades_report limpa com sucesso.");

    // 2. Forçar a criação da constraint única (se já não existir)
    console.log("2. Recriando a trava de segurança (Unique Constraint) no PostgreSQL...");
    try {
      await client`
        ALTER TABLE ava_grades_report 
        ADD CONSTRAINT unq_ava_grades UNIQUE ("sourceInstitution", "user_id", "course_id");
      `;
      console.log("Constraint unq_ava_grades criada com sucesso!");
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log("A constraint unq_ava_grades já existe.");
      } else {
        throw e;
      }
    }

    console.log("Banco de dados corrigido com sucesso! A sincronização de Notas agora funcionará.");
    process.exit(0);
  } catch (error) {
    console.error("Erro ao corrigir banco de dados:", error);
    process.exit(1);
  }
}

fixDatabase();
