CREATE TABLE "local" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"endereco" text NOT NULL,
	"link_local" text,
	"telefone" text,
	"status" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opcao" (
	"id" text PRIMARY KEY NOT NULL,
	"localId" text NOT NULL,
	"data" timestamp NOT NULL,
	"hora" text NOT NULL,
	"vagas" integer NOT NULL,
	"status" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agendamentos_matricula" (
	"id" text PRIMARY KEY NOT NULL,
	"opcaoId" text NOT NULL,
	"matricula" text NOT NULL,
	"descricao" text NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"periodo" text NOT NULL,
	"data" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "unq_agendamento_matricula_periodo" UNIQUE("matricula","periodo")
);
--> statement-breakpoint
ALTER TABLE "agendamentos_matricula" ADD CONSTRAINT "agendamentos_matricula_opcaoId_opcao_id_fk" FOREIGN KEY ("opcaoId") REFERENCES "public"."opcao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opcao" ADD CONSTRAINT "opcao_localId_local_id_fk" FOREIGN KEY ("localId") REFERENCES "public"."local"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agendamento_opcao" ON "agendamentos_matricula" USING btree ("opcaoId");--> statement-breakpoint
CREATE INDEX "idx_agendamento_matricula" ON "agendamentos_matricula" USING btree ("matricula");--> statement-breakpoint
CREATE INDEX "idx_opcao_local" ON "opcao" USING btree ("localId");--> statement-breakpoint
CREATE INDEX "idx_opcao_data" ON "opcao" USING btree ("data");