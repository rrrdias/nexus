CREATE TABLE "ava_openlms" (
	"id" text PRIMARY KEY NOT NULL,
	"unidadeEns" text NOT NULL,
	"urlSandbox" text NOT NULL,
	"tokenSandbox" text NOT NULL,
	"urlProd" text NOT NULL,
	"tokenProd" text NOT NULL,
	"status" boolean DEFAULT true NOT NULL,
	CONSTRAINT "ava_openlms_unidadeEns_unique" UNIQUE("unidadeEns")
);
