import { db } from './index';
import { sql } from 'drizzle-orm';

async function migrateDates() {
  console.log(
    '🚀 Iniciando migração de novas colunas de datas para Tutoria...',
  );

  try {
    // 1. Colunas em tutoria_logs_atividades
    await db.execute(sql`
      ALTER TABLE tutoria_logs_atividades 
      ADD COLUMN IF NOT EXISTS data_primeiro_acesso_conteudo text,
      ADD COLUMN IF NOT EXISTS data_ultimo_acesso_conteudo text,
      ADD COLUMN IF NOT EXISTS data_ultimo_acesso_disciplina text,
      ADD COLUMN IF NOT EXISTS data_ultimo_login text;
    `);
    console.log('✅ Colunas adicionadas em tutoria_logs_atividades.');

    // 2. Colunas em tutoria_engajamento_aluno
    await db.execute(sql`
      ALTER TABLE tutoria_engajamento_aluno 
      ADD COLUMN IF NOT EXISTS data_ultimo_acesso text,
      ADD COLUMN IF NOT EXISTS data_ultimo_login text;
    `);
    console.log('✅ Colunas adicionadas em tutoria_engajamento_aluno.');

    console.log('🎉 Migração de datas concluída com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração de datas da Tutoria:', err);
    process.exit(1);
  }
}

migrateDates();
