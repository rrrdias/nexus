import { db } from './index';
import { sql } from 'drizzle-orm';

/**
 * Migration: Suporte a Múltiplos Tutores, Modelo Híbrido, Linha do Tempo e Trilha de Auditoria
 * Módulo de Tutoria — Nexus Core (Milestone 1)
 */
export async function migrateMultitutor() {
  console.log(
    '🚀 Iniciando migração Multi-Tutor e Trilha de Auditoria de Atendimentos...',
  );

  try {
    // 1. Extensões necessárias
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // 2. Criar tabela tutoria_atendimentos_historico
    console.log('📦 Criando tabela tutoria_atendimentos_historico...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tutoria_atendimentos_historico (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        atendimento_id text REFERENCES tutoria_atendimentos_kanban(id) ON DELETE CASCADE,
        matricula text NOT NULL,
        periodo text NOT NULL,
        "sourceInstitution" text DEFAULT 'ead' NOT NULL,
        tipo_evento text NOT NULL,
        autor_id text REFERENCES "user"(id) ON DELETE SET NULL,
        autor_nome text,
        tutor_responsavel_anterior_id text REFERENCES "user"(id) ON DELETE SET NULL,
        tutor_responsavel_novo_id text REFERENCES "user"(id) ON DELETE SET NULL,
        estado_anterior text,
        estado_novo text,
        canal_contato text,
        observacoes text,
        metadata text,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    // 3. Garantir colunas caso a tabela já tenha sido criada previamente
    await db.execute(sql`
      ALTER TABLE tutoria_atendimentos_historico
      ADD COLUMN IF NOT EXISTS atendimento_id text REFERENCES tutoria_atendimentos_kanban(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS matricula text,
      ADD COLUMN IF NOT EXISTS periodo text,
      ADD COLUMN IF NOT EXISTS "sourceInstitution" text DEFAULT 'ead',
      ADD COLUMN IF NOT EXISTS tipo_evento text,
      ADD COLUMN IF NOT EXISTS autor_id text REFERENCES "user"(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS autor_nome text,
      ADD COLUMN IF NOT EXISTS tutor_responsavel_anterior_id text REFERENCES "user"(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS tutor_responsavel_novo_id text REFERENCES "user"(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS estado_anterior text,
      ADD COLUMN IF NOT EXISTS estado_novo text,
      ADD COLUMN IF NOT EXISTS canal_contato text,
      ADD COLUMN IF NOT EXISTS observacoes text,
      ADD COLUMN IF NOT EXISTS metadata text,
      ADD COLUMN IF NOT EXISTS "createdAt" timestamp with time zone DEFAULT now();
    `);

    // 4. Índices para tutoria_atendimentos_historico
    console.log('⚡ Criando índices para tutoria_atendimentos_historico...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_hist_atendimento ON tutoria_atendimentos_historico (atendimento_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_hist_matricula ON tutoria_atendimentos_historico (matricula);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_hist_created_at ON tutoria_atendimentos_historico ("createdAt");`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_hist_tipo ON tutoria_atendimentos_historico (tipo_evento);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_hist_autor ON tutoria_atendimentos_historico (autor_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_hist_mat_created ON tutoria_atendimentos_historico (matricula, "createdAt" DESC);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_hist_periodo_mat ON tutoria_atendimentos_historico (periodo, matricula);`,
    );

    // 5. Adicionar colunas do modelo híbrido multi-tutor em tutoria_atendimentos_kanban
    console.log(
      '🔄 Atualizando colunas na tabela tutoria_atendimentos_kanban...',
    );
    await db.execute(sql`
      ALTER TABLE tutoria_atendimentos_kanban
      ADD COLUMN IF NOT EXISTS tutor_iniciador_id text REFERENCES "user"(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS ultima_intervencao_em timestamp with time zone,
      ADD COLUMN IF NOT EXISTS qtd_intervencoes integer DEFAULT 0 NOT NULL;
    `);

    // 6. Índices para novos campos do Kanban
    console.log('⚡ Criando índices para novos campos do Kanban...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_tutor_iniciador ON tutoria_atendimentos_kanban (tutor_iniciador_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_ultima_interv ON tutoria_atendimentos_kanban (ultima_intervencao_em);`,
    );

    console.log(
      '🎉 Migração Multi-Tutor e Trilha de Auditoria concluída com sucesso!',
    );
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração Multi-Tutor:', err);
    process.exit(1);
  }
}

void migrateMultitutor();
