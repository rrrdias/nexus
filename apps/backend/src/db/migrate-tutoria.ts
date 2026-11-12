import { db } from './index';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('🚀 Iniciando migração das tabelas do Módulo de Tutoria...');

  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // 1. Tabela de logs detalhados
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tutoria_logs_atividades (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        "sourceInstitution" text NOT NULL,
        periodo text NOT NULL,
        disciplina_id text NOT NULL,
        disciplina_codigo text,
        disciplina_nome text,
        aluno_id text NOT NULL,
        matricula text,
        aluno_nome text,
        aluno_email text,
        unidade_tematica_nome text,
        atividade_id text NOT NULL,
        tipo_modulo text,
        conteudo_nome text,
        qtd_cliques_acessos integer DEFAULT 0,
        tempo_conteudo_minutos text DEFAULT '0',
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS unq_tutoria_logs_atividades 
      ON tutoria_logs_atividades ("sourceInstitution", periodo, disciplina_id, aluno_id, atividade_id);
    `);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_logs_inst_periodo ON tutoria_logs_atividades ("sourceInstitution", periodo);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_logs_aluno_disc ON tutoria_logs_atividades (aluno_id, disciplina_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_logs_mat_disc ON tutoria_logs_atividades (matricula, disciplina_codigo);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_logs_fase ON tutoria_logs_atividades (unidade_tematica_nome);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_logs_aluno_trgm ON tutoria_logs_atividades USING gin (aluno_nome gin_trgm_ops);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_logs_mat_trgm ON tutoria_logs_atividades USING gin (matricula gin_trgm_ops);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_logs_disc_trgm ON tutoria_logs_atividades USING gin (disciplina_nome gin_trgm_ops);`,
    );

    // 2. Tabela de engajamento consolidado
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tutoria_engajamento_aluno (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        "sourceInstitution" text NOT NULL,
        periodo text NOT NULL,
        disciplina_id text NOT NULL,
        disciplina_codigo text,
        disciplina_nome text,
        aluno_id text NOT NULL,
        matricula text,
        aluno_nome text,
        aluno_email text,
        tempo_total_minutos text DEFAULT '0',
        tempo_fase1_minutos text DEFAULT '0',
        tempo_fase2_minutos text DEFAULT '0',
        tempo_fase3_minutos text DEFAULT '0',
        tempo_apresentacao_minutos text DEFAULT '0',
        tempo_outros_minutos text DEFAULT '0',
        total_cliques integer DEFAULT 0,
        total_atividades_acessadas integer DEFAULT 0,
        tempo_leitura_minutos text DEFAULT '0',
        tempo_avaliacoes_minutos text DEFAULT '0',
        grupo_risco_calculado text,
        score_engajamento text,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS unq_tutoria_engajamento_aluno 
      ON tutoria_engajamento_aluno ("sourceInstitution", periodo, disciplina_id, aluno_id);
    `);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_engaj_inst_periodo ON tutoria_engajamento_aluno ("sourceInstitution", periodo);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_engaj_mat ON tutoria_engajamento_aluno (matricula);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_engaj_disc_cod ON tutoria_engajamento_aluno (disciplina_codigo);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_engaj_grupo_risco ON tutoria_engajamento_aluno (grupo_risco_calculado);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_engaj_aluno_trgm ON tutoria_engajamento_aluno USING gin (aluno_nome gin_trgm_ops);`,
    );

    // 3. Tabela de planos de ação
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tutoria_planos_acao (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        "sourceInstitution" text DEFAULT 'ead' NOT NULL,
        periodo text NOT NULL,
        titulo text NOT NULL,
        grupo_tipo text NOT NULL,
        disciplina_codigo text,
        diagnostico_ia text,
        pensamento_ia text,
        orientacoes_tutor text,
        template_mensagem_whatsapp text,
        template_mensagem_email text,
        status text DEFAULT 'ativo' NOT NULL,
        criado_por_id text REFERENCES "user"(id) ON DELETE SET NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_planos_periodo_grupo ON tutoria_planos_acao (periodo, grupo_tipo);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_planos_status ON tutoria_planos_acao (status);`,
    );

    // 4. Tabela de atendimentos Kanban
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tutoria_atendimentos_kanban (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        plano_acao_id text REFERENCES tutoria_planos_acao(id) ON DELETE CASCADE,
        "sourceInstitution" text DEFAULT 'ead' NOT NULL,
        periodo text NOT NULL,
        matricula text NOT NULL,
        aluno_nome text,
        aluno_email text,
        disciplina_codigo text,
        disciplina_nome text,
        status_kanban text DEFAULT 'pendente' NOT NULL,
        tutor_responsavel_id text REFERENCES "user"(id) ON DELETE SET NULL,
        observacoes text,
        canal_contato_utilizado text,
        ultimo_contato_em timestamp with time zone,
        data_resolucao timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`
      ALTER TABLE tutoria_atendimentos_kanban
      ADD COLUMN IF NOT EXISTS aluno_nome text,
      ADD COLUMN IF NOT EXISTS aluno_email text,
      ADD COLUMN IF NOT EXISTS disciplina_codigo text,
      ADD COLUMN IF NOT EXISTS disciplina_nome text,
      ADD COLUMN IF NOT EXISTS canal_contato_utilizado text,
      ADD COLUMN IF NOT EXISTS ultimo_contato_em timestamp with time zone,
      ADD COLUMN IF NOT EXISTS data_resolucao timestamp with time zone,
      ADD COLUMN IF NOT EXISTS plano_acao_id text,
      ADD COLUMN IF NOT EXISTS tutor_responsavel_id text;
    `);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_status ON tutoria_atendimentos_kanban (status_kanban);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_mat ON tutoria_atendimentos_kanban (matricula);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_plano ON tutoria_atendimentos_kanban (plano_acao_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_tutor ON tutoria_atendimentos_kanban (tutor_responsavel_id);`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_periodo ON tutoria_atendimentos_kanban (periodo);`,
    );

    // 5. Cadastrar Módulo Tutoria no system_modules caso não exista
    await db.execute(sql`
      INSERT INTO system_module (id, name, slug, description, "colorCode", "iconClass", "pathUrl", "isActive", "createdAt")
      VALUES (
        gen_random_uuid(),
        'Tutoria',
        'tutoria',
        'Acompanhamento Pedagógico, Análise de Engajamento e Planos de Ação com IA',
        '#6366F1',
        'ti-school',
        '/tutoria',
        true,
        now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        "colorCode" = EXCLUDED."colorCode",
        "iconClass" = EXCLUDED."iconClass",
        "pathUrl" = EXCLUDED."pathUrl",
        "isActive" = true;
    `);

    // 6. Conceder permissão do módulo Tutoria para os grupos e usuários existentes
    await db.execute(sql`
      INSERT INTO group_system_access ("groupId", "systemModuleId")
      SELECT g.id, sm.id FROM "group" g, system_module sm WHERE sm.slug = 'tutoria'
      ON CONFLICT DO NOTHING;
    `);
    await db.execute(sql`
      INSERT INTO users_system_access ("userId", "systemModuleId")
      SELECT u.id, sm.id FROM "user" u, system_module sm WHERE sm.slug = 'tutoria'
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ Migração das tabelas de Tutoria concluída com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração de Tutoria:', err);
    process.exit(1);
  }
}

migrate();
