-- ==============================================================================
-- MIGRAÇÃO CONSOLIDADA: MÓDULO DE TUTORIA & ENGAJAMENTO (NEXUS CORE)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Tabela de logs detalhados de atividades
CREATE TABLE IF NOT EXISTS tutoria_logs_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  data_primeiro_acesso_conteudo text,
  data_ultimo_acesso_conteudo text,
  data_ultimo_acesso_disciplina text,
  data_ultimo_login text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

-- Garante as colunas de data caso a tabela já tenha sido criada anteriormente
ALTER TABLE tutoria_logs_atividades 
ADD COLUMN IF NOT EXISTS data_primeiro_acesso_conteudo text,
ADD COLUMN IF NOT EXISTS data_ultimo_acesso_conteudo text,
ADD COLUMN IF NOT EXISTS data_ultimo_acesso_disciplina text,
ADD COLUMN IF NOT EXISTS data_ultimo_login text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tutoria_inst_per_disc_aluno_ativ 
ON tutoria_logs_atividades ("sourceInstitution", periodo, disciplina_id, aluno_id, atividade_id);

CREATE INDEX IF NOT EXISTS idx_tutoria_logs_disc ON tutoria_logs_atividades (disciplina_id);
CREATE INDEX IF NOT EXISTS idx_tutoria_logs_aluno ON tutoria_logs_atividades (aluno_id);
CREATE INDEX IF NOT EXISTS idx_tutoria_logs_mat ON tutoria_logs_atividades (matricula);
CREATE INDEX IF NOT EXISTS idx_tutoria_logs_periodo ON tutoria_logs_atividades (periodo);
CREATE INDEX IF NOT EXISTS idx_tutoria_logs_modulo ON tutoria_logs_atividades (tipo_modulo);

-- 2. Tabela consolidada de engajamento do aluno
CREATE TABLE IF NOT EXISTS tutoria_engajamento_aluno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  grupo_risco_calculado text DEFAULT 'critico',
  score_engajamento text DEFAULT '0',
  data_ultimo_acesso text,
  data_ultimo_login text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

-- Garante as colunas de data caso a tabela já tenha sido criada anteriormente
ALTER TABLE tutoria_engajamento_aluno 
ADD COLUMN IF NOT EXISTS data_ultimo_acesso text,
ADD COLUMN IF NOT EXISTS data_ultimo_login text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tutoria_engajamento_aluno 
ON tutoria_engajamento_aluno ("sourceInstitution", periodo, disciplina_id, aluno_id);

CREATE INDEX IF NOT EXISTS idx_tutoria_engaj_risco ON tutoria_engajamento_aluno (grupo_risco_calculado);
CREATE INDEX IF NOT EXISTS idx_tutoria_engaj_mat ON tutoria_engajamento_aluno (matricula);
CREATE INDEX IF NOT EXISTS idx_tutoria_engaj_periodo ON tutoria_engajamento_aluno (periodo);
CREATE INDEX IF NOT EXISTS idx_tutoria_engaj_disc ON tutoria_engajamento_aluno (disciplina_id);

-- 3. Tabela de Planos de Ação pedagógicos
CREATE TABLE IF NOT EXISTS tutoria_planos_acao_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceInstitution" text NOT NULL,
  periodo text NOT NULL,
  disciplina_id text NOT NULL,
  aluno_id text NOT NULL,
  matricula text NOT NULL,
  aluno_nome text NOT NULL,
  grupo_risco text NOT NULL,
  score_engajamento text,
  diagnostico_ia text NOT NULL,
  acoes_recomendadas text NOT NULL,
  template_mensagem text NOT NULL,
  tutor_responsavel_id text,
  status_execucao text DEFAULT 'pendente',
  feedback_aluno text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tutoria_planos_risco ON tutoria_planos_acao_ia (grupo_risco);
CREATE INDEX IF NOT EXISTS idx_tutoria_planos_mat ON tutoria_planos_acao_ia (matricula);
CREATE INDEX IF NOT EXISTS idx_tutoria_planos_status ON tutoria_planos_acao_ia (status_execucao);
CREATE INDEX IF NOT EXISTS idx_tutoria_planos_tutor ON tutoria_planos_acao_ia (tutor_responsavel_id);

-- 4. Tabela de Kanban de intervenção da Tutoria
CREATE TABLE IF NOT EXISTS tutoria_atendimentos_kanban (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceInstitution" text DEFAULT 'ead' NOT NULL,
  periodo text NOT NULL,
  matricula text NOT NULL,
  aluno_nome text,
  aluno_email text,
  disciplina_codigo text,
  disciplina_nome text,
  status_kanban text DEFAULT 'pendente' NOT NULL,
  tutor_responsavel_id text,
  observacoes text,
  canal_contato_utilizado text,
  ultimo_contato_em timestamp with time zone,
  data_resolucao timestamp with time zone,
  plano_acao_id text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE tutoria_atendimentos_kanban
ADD COLUMN IF NOT EXISTS aluno_email text,
ADD COLUMN IF NOT EXISTS disciplina_codigo text,
ADD COLUMN IF NOT EXISTS disciplina_nome text,
ADD COLUMN IF NOT EXISTS canal_contato_utilizado text,
ADD COLUMN IF NOT EXISTS ultimo_contato_em timestamp with time zone,
ADD COLUMN IF NOT EXISTS data_resolucao timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_status ON tutoria_atendimentos_kanban (status_kanban);
CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_mat ON tutoria_atendimentos_kanban (matricula);
CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_plano ON tutoria_atendimentos_kanban (plano_acao_id);
CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_tutor ON tutoria_atendimentos_kanban (tutor_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_periodo ON tutoria_atendimentos_kanban (periodo);

-- 5. Cadastro do Módulo Tutoria no catálogo de módulos
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

-- 6. Liberação automática do módulo Tutoria para os grupos e usuários existentes
INSERT INTO group_system_access ("groupId", "systemModuleId")
SELECT g.id, sm.id FROM "group" g, system_module sm WHERE sm.slug = 'tutoria'
ON CONFLICT DO NOTHING;

INSERT INTO users_system_access ("userId", "systemModuleId")
SELECT u.id, sm.id FROM users u, system_module sm WHERE sm.slug = 'tutoria'
ON CONFLICT DO NOTHING;
