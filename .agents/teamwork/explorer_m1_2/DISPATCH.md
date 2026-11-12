# Task Assignment: Explorer 2 (Migration Script & DDL Specialist)

## Mission
Investigate migration scripts and database execution patterns in `apps/backend`:
1. Inspect existing migration scripts in `apps/backend/src/db/` (e.g. `migrate-tutoria.ts`, `migrate.ts`, etc.) and `apps/backend/package.json`.
2. Inspect how database connection is instantiated for migration scripts (e.g., using `dotenv`, `postgres`, `drizzle-orm/postgres-js` or existing db client).
3. Design the exact idempotent SQL DDL statements for `apps/backend/src/db/migrate-tutoria-multitutor.ts`:
   - `CREATE TABLE IF NOT EXISTS tutoria_atendimentos_historico (...)`
   - `ALTER TABLE tutoria_atendimentos_kanban ADD COLUMN IF NOT EXISTS tutor_iniciador_id ...`
   - `ALTER TABLE tutoria_atendimentos_kanban ADD COLUMN IF NOT EXISTS ultima_intervencao_em ...`
   - `ALTER TABLE tutoria_atendimentos_kanban ADD COLUMN IF NOT EXISTS qtd_intervencoes ...`
   - `CREATE INDEX IF NOT EXISTS ...`
4. Define the package.json script entry and verify CLI execution syntax (`tsx src/db/migrate-tutoria-multitutor.ts`).

## Authoritative Context Documents
- ORIGINAL_REQUEST: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT_DEFINITION: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- MILESTONE_SCOPE: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m1\SCOPE.md`

## Output Requirements
Write your investigation report and recommendations to `handoff.md` in your state folder:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_2\handoff.md`
Then send a completion message to the sub-orchestrator. Do NOT write any source code.


## 2026-11-10T20:30:53Z
[Message] sender=ace68dba-ed41-44d1-855e-edda9d576e4a priority=MESSAGE_PRIORITY_HIGH
You are Explorer 2 (Migration Script & DDL Specialist) for Milestone 1.
Read your full dispatch instructions at:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_2\DISPATCH.md`
