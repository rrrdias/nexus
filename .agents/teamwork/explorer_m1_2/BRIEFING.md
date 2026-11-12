# BRIEFING — 2026-11-10T20:37:30Z

## Mission
Investigate database connection setup, migration patterns, idempotent SQL DDL syntax, and package.json script configuration for `apps/backend/src/db/migrate-tutoria-multitutor.ts`.

## 🔒 My Identity
- Archetype: explorer
- Roles: Migration Script & DDL Specialist, Investigation, Synthesis
- Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
- State folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_2
- Original parent: ace68dba-ed41-44d1-855e-edda9d576e4a
- Milestone: M1 (Backend Schema & Migrations)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify any project source code files
- Provide exact code blueprints with file paths and line numbers
- Output comprehensive findings in handoff.md following the 5-component handoff report protocol

## Current Parent
- Conversation ID: ace68dba-ed41-44d1-855e-edda9d576e4a
- Updated: 2026-11-10T20:37:30Z

## Investigation State
- **Explored paths**:
  - `apps/backend/src/db/migrate-tutoria.ts` (lines 1-228)
  - `apps/backend/src/db/migrate-tutoria-dates.ts` (lines 1-36)
  - `apps/backend/src/db/migrate-tutoria.sql` (lines 1-181)
  - `apps/backend/src/db/index.ts` (lines 1-9)
  - `apps/backend/src/db/schema.ts` (lines 1-805)
  - `apps/backend/package.json` (lines 1-107)
  - `apps/backend/tsconfig.json` & `tsconfig.build.json`
  - `apps/backend/src/tutoria/tutoria.service.ts` (lines 1-115)
- **Key findings**:
  - Database connection is instantiated via `import { db } from './index'`, which runs `dotenv.config()` and initializes postgres client with drizzle.
  - Foreign key relations to users must reference `"user"(id)` with double quotes due to PostgreSQL reserved keyword.
  - All foreign key columns (`atendimento_id`, `autor_id`, `tutor_responsavel_anterior_id`, `tutor_responsavel_novo_id`, `tutor_iniciador_id`) use `text` type, matching `schema.ts`.
  - Runner verification: `npx tsx` and `npm exec -- tsx` work seamlessly in `apps/backend` via hoisted workspace dependencies. `ts-node` also works.
  - Migration script pattern: `db.execute(sql`...`)` in `async function migrateMultitutor()`, with defensive `CREATE TABLE IF NOT EXISTS`, followed by `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS`.
- **Unexplored areas**: None. Investigation complete.

## Key Decisions Made
- Architecture blueprint for `migrate-tutoria-multitutor.ts` matches existing project migration scripts with complete defensive idempotency.
- Registered package.json entries: `"db:migrate-tutoria-multitutor": "tsx src/db/migrate-tutoria-multitutor.ts"` and production script `"db:migrate-tutoria-multitutor:prod": "node dist/db/migrate-tutoria-multitutor.js"`.

## Artifact Index
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_2\handoff.md — Final investigation and blueprint report
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_2\progress.md — Liveness heartbeat and task progress
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_2\DISPATCH.md — Task dispatch records
