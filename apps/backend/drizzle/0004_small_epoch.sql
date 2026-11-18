CREATE TABLE "academic_online_matricula" (
	"id" text PRIMARY KEY NOT NULL,
	"turma_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"matricula" text NOT NULL,
	"nome_aluno" text NOT NULL,
	"email_aluno" text,
	"cpf_aluno" text,
	"periodo" text NOT NULL,
	"situacao_lyceum" text,
	"ativo_lyceum" text,
	"status_matricula" text NOT NULL,
	"enrolment_status_ava" text,
	"bloqueio_lancamento" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unq_ac_online_mat_turma_aluno" UNIQUE("turma_id","matricula")
);
--> statement-breakpoint
CREATE TABLE "academic_online_nota" (
	"id" text PRIMARY KEY NOT NULL,
	"turma_id" text NOT NULL,
	"matricula_id" text NOT NULL,
	"matricula" text NOT NULL,
	"sourceInstitution" text DEFAULT 'ead' NOT NULL,
	"moodle_course_id" text,
	"moodle_user_id" text,
	"va1_raw" text,
	"va2_raw" text,
	"va3_raw" text,
	"media_raw" text,
	"va1_nota" numeric(5, 2),
	"va2_nota" numeric(5, 2),
	"va3_nota" numeric(5, 2),
	"media_final_nota" numeric(5, 2),
	"va1_status" text DEFAULT 'Pendente' NOT NULL,
	"va2_status" text DEFAULT 'Pendente' NOT NULL,
	"va3_status" text DEFAULT 'Pendente' NOT NULL,
	"itens_va1" text,
	"itens_va2" text,
	"itens_va3" text,
	"raw_lista_notas" text,
	"status_consolidacao" text DEFAULT 'pendente' NOT NULL,
	"divergencia_motivo" text,
	"last_ava_sync_at" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unq_ac_online_nota_turma_mat" UNIQUE("turma_id","matricula"),
	CONSTRAINT "unq_ac_online_nota_mat_id" UNIQUE("matricula_id")
);
--> statement-breakpoint
CREATE TABLE "academic_online_turma" (
	"id" text PRIMARY KEY NOT NULL,
	"turma" text NOT NULL,
	"cod_turma" text,
	"disciplina" text NOT NULL,
	"nome_disciplina" text NOT NULL,
	"cod_disciplina" text,
	"curso" text,
	"curso_nome" text,
	"curso_instituicao" text,
	"periodo" text NOT NULL,
	"modelagem" text DEFAULT 'DISCIPLINA 100% ONLINE' NOT NULL,
	"sourceInstitution" text DEFAULT 'ead' NOT NULL,
	"moodle_course_id" text,
	"moodle_course_fullname" text,
	"total_alunos" integer DEFAULT 0 NOT NULL,
	"total_matriculados" integer DEFAULT 0 NOT NULL,
	"total_suspensos" integer DEFAULT 0 NOT NULL,
	"total_cancelados" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ava_consolidated_report" (
	"id" text PRIMARY KEY NOT NULL,
	"sourceInstitution" text NOT NULL,
	"aluno_id" text,
	"matricula" text,
	"usuario" text,
	"aluno" text,
	"email" text,
	"user_phone1" text,
	"periodo" text,
	"subcategoria" text,
	"curso" text,
	"curso_perfil" text,
	"periodo_perfil" text,
	"unidade_fisica" text,
	"enrolment_status" text,
	"lastaccess" text,
	"dias_sem_acesso" text,
	"progresso_fase1" text,
	"progresso_fase2" text,
	"progresso_fase3" text,
	"progresso_total" text,
	"progresso_lista_fase1" text,
	"progresso_lista_fase2" text,
	"progresso_lista_fase3" text,
	"grade_id" text,
	"nota_fase1" text,
	"nota_fase2" text,
	"nota_fase3" text,
	"media_final" text,
	"notas_lista_fase1" text,
	"notas_lista_fase2" text,
	"notas_lista_fase3" text,
	"lista_notas" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unq_ava_consolidated" UNIQUE("sourceInstitution","aluno_id","curso")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tutoria_atendimentos_historico" (
	"id" text PRIMARY KEY NOT NULL,
	"atendimento_id" text,
	"matricula" text NOT NULL,
	"periodo" text NOT NULL,
	"sourceInstitution" text DEFAULT 'ead' NOT NULL,
	"tipo_evento" text NOT NULL,
	"autor_id" text,
	"autor_nome" text,
	"tutor_responsavel_anterior_id" text,
	"tutor_responsavel_novo_id" text,
	"estado_anterior" text,
	"estado_novo" text,
	"canal_contato" text,
	"observacoes" text,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutoria_atendimentos_kanban" (
	"id" text PRIMARY KEY NOT NULL,
	"plano_acao_id" text,
	"sourceInstitution" text DEFAULT 'ead' NOT NULL,
	"periodo" text NOT NULL,
	"matricula" text NOT NULL,
	"aluno_nome" text,
	"aluno_email" text,
	"disciplina_codigo" text,
	"disciplina_nome" text,
	"status_kanban" text DEFAULT 'pendente' NOT NULL,
	"tutor_responsavel_id" text,
	"tutor_iniciador_id" text,
	"observacoes" text,
	"canal_contato_utilizado" text,
	"ultimo_contato_em" timestamp,
	"data_resolucao" timestamp,
	"ultima_intervencao_em" timestamp,
	"qtd_intervencoes" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutoria_engajamento_aluno" (
	"id" text PRIMARY KEY NOT NULL,
	"sourceInstitution" text NOT NULL,
	"periodo" text NOT NULL,
	"disciplina_id" text NOT NULL,
	"disciplina_codigo" text,
	"disciplina_nome" text,
	"aluno_id" text NOT NULL,
	"matricula" text,
	"aluno_nome" text,
	"aluno_email" text,
	"tempo_total_minutos" text DEFAULT '0',
	"tempo_fase1_minutos" text DEFAULT '0',
	"tempo_fase2_minutos" text DEFAULT '0',
	"tempo_fase3_minutos" text DEFAULT '0',
	"tempo_apresentacao_minutos" text DEFAULT '0',
	"tempo_outros_minutos" text DEFAULT '0',
	"total_cliques" integer DEFAULT 0,
	"total_atividades_acessadas" integer DEFAULT 0,
	"tempo_leitura_minutos" text DEFAULT '0',
	"tempo_avaliacoes_minutos" text DEFAULT '0',
	"grupo_risco_calculado" text,
	"score_engajamento" text,
	"data_ultimo_acesso" text,
	"data_ultimo_login" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unq_tutoria_engajamento_aluno" UNIQUE("sourceInstitution","periodo","disciplina_id","aluno_id")
);
--> statement-breakpoint
CREATE TABLE "tutoria_logs_atividades" (
	"id" text PRIMARY KEY NOT NULL,
	"sourceInstitution" text NOT NULL,
	"periodo" text NOT NULL,
	"disciplina_id" text NOT NULL,
	"disciplina_codigo" text,
	"disciplina_nome" text,
	"aluno_id" text NOT NULL,
	"matricula" text,
	"aluno_nome" text,
	"aluno_email" text,
	"unidade_tematica_nome" text,
	"atividade_id" text NOT NULL,
	"tipo_modulo" text,
	"conteudo_nome" text,
	"qtd_cliques_acessos" integer DEFAULT 0,
	"tempo_conteudo_minutos" text DEFAULT '0',
	"data_primeiro_acesso_conteudo" text,
	"data_ultimo_acesso_conteudo" text,
	"data_ultimo_acesso_disciplina" text,
	"data_ultimo_login" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unq_tutoria_logs_atividades" UNIQUE("sourceInstitution","periodo","disciplina_id","aluno_id","atividade_id")
);
--> statement-breakpoint
CREATE TABLE "tutoria_planos_acao" (
	"id" text PRIMARY KEY NOT NULL,
	"sourceInstitution" text DEFAULT 'ead' NOT NULL,
	"periodo" text NOT NULL,
	"titulo" text NOT NULL,
	"grupo_tipo" text NOT NULL,
	"disciplina_codigo" text,
	"diagnostico_ia" text,
	"pensamento_ia" text,
	"orientacoes_tutor" text,
	"template_mensagem_whatsapp" text,
	"template_mensagem_email" text,
	"status" text DEFAULT 'ativo' NOT NULL,
	"criado_por_id" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agendamentos_matricula" DROP CONSTRAINT "unq_agendamento_matricula_periodo";--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_userId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "timestamp" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "academic_matricula" ADD COLUMN "ativo" text;--> statement-breakpoint
ALTER TABLE "academic_matricula" ADD COLUMN "situacao" text;--> statement-breakpoint
ALTER TABLE "academic_turma" ADD COLUMN "data_atualizacao" timestamp;--> statement-breakpoint
ALTER TABLE "academic_turma" ADD COLUMN "data_inicio_turma" timestamp;--> statement-breakpoint
ALTER TABLE "academic_turma" ADD COLUMN "data_fim_turma" timestamp;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "userEmail" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "userName" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "category" text DEFAULT 'SYSTEM' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "status" text DEFAULT 'SUCCESS' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "details" text;--> statement-breakpoint
ALTER TABLE "ava_grades_report" ADD COLUMN "lista_fase1" text;--> statement-breakpoint
ALTER TABLE "ava_grades_report" ADD COLUMN "lista_fase2" text;--> statement-breakpoint
ALTER TABLE "ava_grades_report" ADD COLUMN "lista_fase3" text;--> statement-breakpoint
ALTER TABLE "ava_grades_report" ADD COLUMN "lista_notas" text;--> statement-breakpoint
ALTER TABLE "ava_progress_report" ADD COLUMN "subcategoria" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "lastLoginAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "academic_online_matricula" ADD CONSTRAINT "academic_online_matricula_turma_id_academic_online_turma_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."academic_online_turma"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_online_nota" ADD CONSTRAINT "academic_online_nota_turma_id_academic_online_turma_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."academic_online_turma"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_online_nota" ADD CONSTRAINT "academic_online_nota_matricula_id_academic_online_matricula_id_fk" FOREIGN KEY ("matricula_id") REFERENCES "public"."academic_online_matricula"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoria_atendimentos_historico" ADD CONSTRAINT "tutoria_atendimentos_historico_atendimento_id_tutoria_atendimentos_kanban_id_fk" FOREIGN KEY ("atendimento_id") REFERENCES "public"."tutoria_atendimentos_kanban"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoria_atendimentos_historico" ADD CONSTRAINT "tutoria_atendimentos_historico_autor_id_user_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoria_atendimentos_historico" ADD CONSTRAINT "tutoria_atendimentos_historico_tutor_responsavel_anterior_id_user_id_fk" FOREIGN KEY ("tutor_responsavel_anterior_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoria_atendimentos_historico" ADD CONSTRAINT "tutoria_atendimentos_historico_tutor_responsavel_novo_id_user_id_fk" FOREIGN KEY ("tutor_responsavel_novo_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoria_atendimentos_kanban" ADD CONSTRAINT "tutoria_atendimentos_kanban_plano_acao_id_tutoria_planos_acao_id_fk" FOREIGN KEY ("plano_acao_id") REFERENCES "public"."tutoria_planos_acao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoria_atendimentos_kanban" ADD CONSTRAINT "tutoria_atendimentos_kanban_tutor_responsavel_id_user_id_fk" FOREIGN KEY ("tutor_responsavel_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoria_atendimentos_kanban" ADD CONSTRAINT "tutoria_atendimentos_kanban_tutor_iniciador_id_user_id_fk" FOREIGN KEY ("tutor_iniciador_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoria_planos_acao" ADD CONSTRAINT "tutoria_planos_acao_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ac_online_mat_turma" ON "academic_online_matricula" USING btree ("turma_id");--> statement-breakpoint
CREATE INDEX "idx_ac_online_mat_matricula" ON "academic_online_matricula" USING btree ("matricula");--> statement-breakpoint
CREATE INDEX "idx_ac_online_mat_usuario" ON "academic_online_matricula" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "idx_ac_online_mat_status" ON "academic_online_matricula" USING btree ("status_matricula");--> statement-breakpoint
CREATE INDEX "idx_ac_online_mat_bloqueio" ON "academic_online_matricula" USING btree ("bloqueio_lancamento");--> statement-breakpoint
CREATE INDEX "idx_ac_online_mat_aluno_trgm" ON "academic_online_matricula" USING gin ("nome_aluno" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_online_mat_mat_trgm" ON "academic_online_matricula" USING gin ("matricula" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_online_nota_turma" ON "academic_online_nota" USING btree ("turma_id");--> statement-breakpoint
CREATE INDEX "idx_ac_online_nota_mat" ON "academic_online_nota" USING btree ("matricula");--> statement-breakpoint
CREATE INDEX "idx_ac_online_nota_mat_id" ON "academic_online_nota" USING btree ("matricula_id");--> statement-breakpoint
CREATE INDEX "idx_ac_online_nota_status_cons" ON "academic_online_nota" USING btree ("status_consolidacao");--> statement-breakpoint
CREATE INDEX "idx_ac_online_nota_fase_status" ON "academic_online_nota" USING btree ("va1_status","va2_status","va3_status");--> statement-breakpoint
CREATE INDEX "idx_ac_online_turma_periodo" ON "academic_online_turma" USING btree ("periodo");--> statement-breakpoint
CREATE INDEX "idx_ac_online_turma_inst" ON "academic_online_turma" USING btree ("sourceInstitution");--> statement-breakpoint
CREATE INDEX "idx_ac_online_turma_disc" ON "academic_online_turma" USING btree ("disciplina");--> statement-breakpoint
CREATE INDEX "idx_ac_online_turma_codigo" ON "academic_online_turma" USING btree ("turma");--> statement-breakpoint
CREATE INDEX "idx_ac_online_turma_nome_trgm" ON "academic_online_turma" USING gin ("nome_disciplina" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_online_turma_cod_trgm" ON "academic_online_turma" USING gin ("turma" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ava_consolidated_inst_period" ON "ava_consolidated_report" USING btree ("sourceInstitution","periodo");--> statement-breakpoint
CREATE INDEX "idx_ava_consolidated_filters" ON "ava_consolidated_report" USING btree ("sourceInstitution","periodo","curso_perfil","periodo_perfil","unidade_fisica");--> statement-breakpoint
CREATE INDEX "idx_ava_consolidated_status" ON "ava_consolidated_report" USING btree ("sourceInstitution","enrolment_status");--> statement-breakpoint
CREATE INDEX "idx_ava_consolidated_aluno_trgm" ON "ava_consolidated_report" USING gin ("aluno" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ava_consolidated_curso_trgm" ON "ava_consolidated_report" USING gin ("curso" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ava_consolidated_matricula_trgm" ON "ava_consolidated_report" USING gin ("matricula" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_pwd_reset_token" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_pwd_reset_user" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pwd_reset_email" ON "password_reset_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_tutoria_hist_atendimento" ON "tutoria_atendimentos_historico" USING btree ("atendimento_id");--> statement-breakpoint
CREATE INDEX "idx_tutoria_hist_matricula" ON "tutoria_atendimentos_historico" USING btree ("matricula");--> statement-breakpoint
CREATE INDEX "idx_tutoria_hist_created_at" ON "tutoria_atendimentos_historico" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_tutoria_hist_tipo" ON "tutoria_atendimentos_historico" USING btree ("tipo_evento");--> statement-breakpoint
CREATE INDEX "idx_tutoria_hist_autor" ON "tutoria_atendimentos_historico" USING btree ("autor_id");--> statement-breakpoint
CREATE INDEX "idx_tutoria_kanban_status" ON "tutoria_atendimentos_kanban" USING btree ("status_kanban");--> statement-breakpoint
CREATE INDEX "idx_tutoria_kanban_mat" ON "tutoria_atendimentos_kanban" USING btree ("matricula");--> statement-breakpoint
CREATE INDEX "idx_tutoria_kanban_plano" ON "tutoria_atendimentos_kanban" USING btree ("plano_acao_id");--> statement-breakpoint
CREATE INDEX "idx_tutoria_kanban_tutor" ON "tutoria_atendimentos_kanban" USING btree ("tutor_responsavel_id");--> statement-breakpoint
CREATE INDEX "idx_tutoria_kanban_tutor_iniciador" ON "tutoria_atendimentos_kanban" USING btree ("tutor_iniciador_id");--> statement-breakpoint
CREATE INDEX "idx_tutoria_kanban_periodo" ON "tutoria_atendimentos_kanban" USING btree ("periodo");--> statement-breakpoint
CREATE INDEX "idx_tutoria_engaj_inst_periodo" ON "tutoria_engajamento_aluno" USING btree ("sourceInstitution","periodo");--> statement-breakpoint
CREATE INDEX "idx_tutoria_engaj_mat" ON "tutoria_engajamento_aluno" USING btree ("matricula");--> statement-breakpoint
CREATE INDEX "idx_tutoria_engaj_disc_cod" ON "tutoria_engajamento_aluno" USING btree ("disciplina_codigo");--> statement-breakpoint
CREATE INDEX "idx_tutoria_engaj_grupo_risco" ON "tutoria_engajamento_aluno" USING btree ("grupo_risco_calculado");--> statement-breakpoint
CREATE INDEX "idx_tutoria_engaj_aluno_trgm" ON "tutoria_engajamento_aluno" USING gin ("aluno_nome" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_tutoria_logs_inst_periodo" ON "tutoria_logs_atividades" USING btree ("sourceInstitution","periodo");--> statement-breakpoint
CREATE INDEX "idx_tutoria_logs_aluno_disc" ON "tutoria_logs_atividades" USING btree ("aluno_id","disciplina_id");--> statement-breakpoint
CREATE INDEX "idx_tutoria_logs_mat_disc" ON "tutoria_logs_atividades" USING btree ("matricula","disciplina_codigo");--> statement-breakpoint
CREATE INDEX "idx_tutoria_logs_fase" ON "tutoria_logs_atividades" USING btree ("unidade_tematica_nome");--> statement-breakpoint
CREATE INDEX "idx_tutoria_logs_aluno_trgm" ON "tutoria_logs_atividades" USING gin ("aluno_nome" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_tutoria_logs_mat_trgm" ON "tutoria_logs_atividades" USING gin ("matricula" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_tutoria_logs_disc_trgm" ON "tutoria_logs_atividades" USING gin ("disciplina_nome" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_tutoria_planos_periodo_grupo" ON "tutoria_planos_acao" USING btree ("periodo","grupo_tipo");--> statement-breakpoint
CREATE INDEX "idx_tutoria_planos_status" ON "tutoria_planos_acao" USING btree ("status");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ac_discente_mat" ON "academic_discente" USING btree ("matricula");--> statement-breakpoint
CREATE INDEX "idx_ac_discente_curso_polo" ON "academic_discente" USING btree ("curso","unidade_fisica");--> statement-breakpoint
CREATE INDEX "idx_ac_mat_turma_nivel_ativo" ON "academic_matricula" USING btree ("turma_id","nivel","ativo");--> statement-breakpoint
CREATE INDEX "idx_ac_turma_periodo_disc" ON "academic_turma" USING btree ("periodo","disciplina");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_agendamento_matricula_periodo_ativo" ON "agendamentos_matricula" USING btree ("matricula","periodo") WHERE "deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_agendamento_periodo_status" ON "agendamentos_matricula" USING btree ("periodo","status");--> statement-breakpoint
CREATE INDEX "idx_audit_log_category" ON "audit_log" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_audit_log_timestamp" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_opcao_local_status_data" ON "opcao" USING btree ("localId","status","data");--> statement-breakpoint
CREATE INDEX "idx_system_module_is_active" ON "system_module" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_user_is_active" ON "user" USING btree ("isActive");