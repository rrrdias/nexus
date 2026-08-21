CREATE TABLE "academic_discente" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text,
	"email" text,
	"cpf" text,
	"serie" text,
	"turno" text,
	"telefone" text,
	"cidade" text,
	"pais" text,
	"curso" text,
	"unidade_fisica" text,
	"nome_social" text,
	"nome_unidade_fisica" text,
	"sobrenome" text,
	"sobrenome_social" text,
	"curso_nome" text,
	"curso_instituicao" text,
	"matricula" text,
	"usuario" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_docente" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text,
	"email" text,
	"cpf" text,
	"telefone" text,
	"cidade" text,
	"pais" text,
	"sobrenome" text,
	"nome_social" text,
	"sobrenome_social" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_matricula" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"turma_id" text NOT NULL,
	"nivel" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unq_ac_matricula" UNIQUE("usuario_id","turma_id","nivel")
);
--> statement-breakpoint
CREATE TABLE "academic_turma" (
	"id" text PRIMARY KEY NOT NULL,
	"turma" text,
	"cod_turma" text,
	"disciplina" text,
	"nome_disciplina" text,
	"cod_disciplina" text,
	"curso" text,
	"periodo" text,
	"serie" text,
	"modelagem" text,
	"curso_nome" text,
	"curso_instituicao" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_ac_discente_nome_trgm" ON "academic_discente" USING gin ("nome" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_discente_sobrenome_trgm" ON "academic_discente" USING gin ("sobrenome" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_discente_cpf_trgm" ON "academic_discente" USING gin ("cpf" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_discente_mat_trgm" ON "academic_discente" USING gin ("matricula" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_discente_usu_trgm" ON "academic_discente" USING gin ("usuario" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_docente_nome_trgm" ON "academic_docente" USING gin ("nome" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_docente_sobrenome_trgm" ON "academic_docente" USING gin ("sobrenome" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_docente_cpf_trgm" ON "academic_docente" USING gin ("cpf" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_matricula_usuario" ON "academic_matricula" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "idx_ac_matricula_turma" ON "academic_matricula" USING btree ("turma_id");--> statement-breakpoint
CREATE INDEX "idx_ac_turma_periodo" ON "academic_turma" USING btree ("periodo");--> statement-breakpoint
CREATE INDEX "idx_ac_turma_trgm" ON "academic_turma" USING gin ("turma" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_turma_cod_trgm" ON "academic_turma" USING gin ("cod_turma" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_turma_disc_trgm" ON "academic_turma" USING gin ("disciplina" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ac_turma_nome_disc_trgm" ON "academic_turma" USING gin ("nome_disciplina" gin_trgm_ops);