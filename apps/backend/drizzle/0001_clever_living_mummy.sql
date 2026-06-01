CREATE TABLE "integration_job" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"profile" text NOT NULL,
	"unidade" text NOT NULL,
	"periodo" text NOT NULL,
	"status" text NOT NULL,
	"logs" text,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"finishedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "synced_matricula" (
	"unidadeEns" text NOT NULL,
	"turma" text NOT NULL,
	"username" text NOT NULL,
	"nivel" integer NOT NULL,
	CONSTRAINT "synced_matricula_unidadeEns_turma_username_nivel_pk" PRIMARY KEY("unidadeEns","turma","username","nivel")
);
--> statement-breakpoint
CREATE TABLE "synced_turma" (
	"unidadeEns" text NOT NULL,
	"turmaId" text NOT NULL,
	CONSTRAINT "synced_turma_unidadeEns_turmaId_pk" PRIMARY KEY("unidadeEns","turmaId")
);
--> statement-breakpoint
CREATE TABLE "synced_usuario" (
	"unidadeEns" text NOT NULL,
	"username" text NOT NULL,
	CONSTRAINT "synced_usuario_unidadeEns_username_pk" PRIMARY KEY("unidadeEns","username")
);
--> statement-breakpoint
CREATE INDEX "idx_synced_mat_lookup" ON "synced_matricula" USING btree ("turma","username");--> statement-breakpoint
CREATE INDEX "idx_synced_turmas_id" ON "synced_turma" USING btree ("turmaId");