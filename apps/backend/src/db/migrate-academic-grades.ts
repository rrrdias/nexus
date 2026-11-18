import { db } from './index';
import { sql } from 'drizzle-orm';

/**
 * Migration: Submódulo Academic Grades (Espelhamento de Turmas 100% Online, Matrículas e Notas VA1/VA2/VA3)
 * Nexus Core (Fase 1)
 */
export async function migrateAcademicGrades() {
  console.log(
    '🚀 Iniciando migração do Submódulo Academic Grades (academic_online_*)...',
  );

  try {
    // 1. Extensão trigram para buscas textuais
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // 2. Tabela: academic_online_turma
    console.log('📦 Criando tabela academic_online_turma...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS academic_online_turma (
        id text PRIMARY KEY,
        turma text NOT NULL,
        cod_turma text,
        disciplina text NOT NULL,
        nome_disciplina text NOT NULL,
        cod_disciplina text,
        curso text,
        curso_nome text,
        curso_instituicao text,
        periodo text NOT NULL,
        modelagem text NOT NULL DEFAULT 'DISCIPLINA 100% ONLINE',
        "sourceInstitution" text NOT NULL DEFAULT 'ead',
        moodle_course_id text,
        moodle_course_fullname text,
        total_alunos integer NOT NULL DEFAULT 0,
        total_matriculados integer NOT NULL DEFAULT 0,
        total_suspensos integer NOT NULL DEFAULT 0,
        total_cancelados integer NOT NULL DEFAULT 0,
        synced_at timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_turma_periodo ON academic_online_turma (periodo);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_turma_inst ON academic_online_turma ("sourceInstitution");`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_turma_disc ON academic_online_turma (disciplina);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_turma_codigo ON academic_online_turma (turma);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_turma_nome_trgm ON academic_online_turma USING gin (nome_disciplina gin_trgm_ops);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_turma_cod_trgm ON academic_online_turma USING gin (turma gin_trgm_ops);`,
    );

    // 3. Tabela: academic_online_matricula
    console.log('📦 Criando tabela academic_online_matricula...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS academic_online_matricula (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        turma_id text NOT NULL REFERENCES academic_online_turma(id) ON DELETE CASCADE,
        usuario_id text NOT NULL,
        matricula text NOT NULL,
        nome_aluno text NOT NULL,
        email_aluno text,
        cpf_aluno text,
        periodo text NOT NULL,
        situacao_lyceum text,
        ativo_lyceum text,
        status_matricula text NOT NULL,
        enrolment_status_ava text,
        bloqueio_lancamento boolean NOT NULL DEFAULT false,
        synced_at timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT unq_ac_online_mat_turma_aluno UNIQUE (turma_id, matricula)
      );
    `);

    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_mat_turma ON academic_online_matricula (turma_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_mat_matricula ON academic_online_matricula (matricula);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_mat_usuario ON academic_online_matricula (usuario_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_mat_status ON academic_online_matricula (status_matricula);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_mat_bloqueio ON academic_online_matricula (bloqueio_lancamento);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_mat_aluno_trgm ON academic_online_matricula USING gin (nome_aluno gin_trgm_ops);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_mat_mat_trgm ON academic_online_matricula USING gin (matricula gin_trgm_ops);`,
    );

    // 4. Tabela: academic_online_nota
    console.log('📦 Criando tabela academic_online_nota...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS academic_online_nota (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        turma_id text NOT NULL REFERENCES academic_online_turma(id) ON DELETE CASCADE,
        matricula_id text NOT NULL REFERENCES academic_online_matricula(id) ON DELETE CASCADE,
        matricula text NOT NULL,
        "sourceInstitution" text NOT NULL DEFAULT 'ead',
        moodle_course_id text,
        moodle_user_id text,
        va1_raw text,
        va2_raw text,
        va3_raw text,
        media_raw text,
        va1_nota numeric(5, 2),
        va2_nota numeric(5, 2),
        va3_nota numeric(5, 2),
        media_final_nota numeric(5, 2),
        va1_status text NOT NULL DEFAULT 'Pendente',
        va2_status text NOT NULL DEFAULT 'Pendente',
        va3_status text NOT NULL DEFAULT 'Pendente',
        itens_va1 text,
        itens_va2 text,
        itens_va3 text,
        raw_lista_notas text,
        status_consolidacao text NOT NULL DEFAULT 'pendente',
        divergencia_motivo text,
        last_ava_sync_at timestamp,
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT unq_ac_online_nota_turma_mat UNIQUE (turma_id, matricula),
        CONSTRAINT unq_ac_online_nota_mat_id UNIQUE (matricula_id)
      );
    `);

    await db.execute(sql`
      ALTER TABLE academic_online_nota
        ALTER COLUMN va1_nota TYPE numeric(5, 2),
        ALTER COLUMN va2_nota TYPE numeric(5, 2),
        ALTER COLUMN va3_nota TYPE numeric(5, 2),
        ALTER COLUMN media_final_nota TYPE numeric(5, 2);
    `);

    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_nota_turma ON academic_online_nota (turma_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_nota_mat ON academic_online_nota (matricula);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_nota_mat_id ON academic_online_nota (matricula_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_nota_status_cons ON academic_online_nota (status_consolidacao);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_ac_online_nota_fase_status ON academic_online_nota (va1_status, va2_status, va3_status);`,
    );

    console.log(
      '🎉 Migração do Submódulo Academic Grades concluída com sucesso!',
    );
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração do Submódulo Academic Grades:', err);
    process.exit(1);
  }
}

void migrateAcademicGrades();
