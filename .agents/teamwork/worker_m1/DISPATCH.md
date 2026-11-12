# Task Assignment: Worker M1 (Backend Schema & Migrations Implementation)

## Mission
Implement Milestone 1: Backend Drizzle schema updates, migration script, and runtime table bootstrap for the multi-tutor audit trail in `apps/backend`.

## Authoritative Context Documents
- ORIGINAL_REQUEST: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT_DEFINITION: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- MILESTONE_SCOPE: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m1\SCOPE.md`
- Explorer 1 Handoff (Schema & Relations): `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_1\handoff.md`
- Explorer 2 Handoff (Migration Script & Package): `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_2\handoff.md`
- Explorer 3 Handoff (Service Bootstrap & Unit Tests): `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_3\handoff.md`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## File Boundaries & Ownership
You exclusively own and may edit or create the following files:
1. `apps/backend/src/db/schema.ts`
2. `apps/backend/src/db/migrate-tutoria-multitutor.ts`
3. `apps/backend/package.json`
4. `apps/backend/src/tutoria/tutoria.service.ts`
5. `apps/backend/src/tutoria/tutoria.service.spec.ts`

## Specific Tasks
1. **Schema Updates (`apps/backend/src/db/schema.ts`)**:
   - Import `relations` from `drizzle-orm`.
   - Update `tutoriaAtendimentosKanban` to include `tutorIniciadorId`, `ultimaIntervencaoEm`, `qtdIntervencoes`, and index `idx_tutoria_kanban_tutor_iniciador`.
   - Add `tutoriaAtendimentosHistorico` table definition with all 16 fields (`id`, `atendimentoId`, `matricula`, `periodo`, `sourceInstitution`, `tipoEvento`, `autorId`, `autorNome`, `tutorResponsavelAnteriorId`, `tutorResponsavelNovoId`, `estadoAnterior`, `estadoNovo`, `canalContato`, `observacoes`, `metadata`, `createdAt`) and 5 indexes (`idx_tutoria_hist_atendimento`, `idx_tutoria_hist_matricula`, `idx_tutoria_hist_created_at`, `idx_tutoria_hist_tipo`, `idx_tutoria_hist_autor`).
   - Define relations with explicit disambiguating `relationName`s:
     - `tutoriaAtendimentosKanbanRelations` (`planoAcao`, `tutorResponsavel`, `tutorIniciador`, `historico`)
     - `tutoriaAtendimentosHistoricoRelations` (`atendimento`, `autor`, `tutorResponsavelAnterior`, `tutorResponsavelNovo`)
     - `usersRelations` (`kanbanAtendimentosComoResponsavel`, `kanbanAtendimentosComoIniciador`, `historicoComoAutor`, `historicoComoTutorAnterior`, `historicoComoTutorNovo`)
   - Export TypeScript types: `TutoriaAtendimentoHistorico`, `NewTutoriaAtendimentoHistorico`, `TutoriaAtendimentoKanban`, `NewTutoriaAtendimentoKanban`, `TutoriaTipoEvento`, `TutoriaCanalContato`.
2. **Migration Script & Package Registration**:
   - Create `apps/backend/src/db/migrate-tutoria-multitutor.ts` using idempotent SQL DDL (`CREATE TABLE IF NOT EXISTS`, defensive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). Ensure `"user"`, `"sourceInstitution"`, and `"createdAt"` are properly quoted.
   - Register `"db:migrate-tutoria-multitutor": "tsx src/db/migrate-tutoria-multitutor.ts"` and `"db:migrate-tutoria-multitutor:prod": "node dist/db/migrate-tutoria-multitutor.js"` in `apps/backend/package.json`.
3. **Runtime Bootstrap in `TutoriaService`**:
   - Add `private hasEnsuredTimelineTable = false;` in `apps/backend/src/tutoria/tutoria.service.ts`.
   - Call `await this.ensureTimelineTable();` in `onModuleInit()`.
   - Implement `ensureTimelineTable()` with idempotent SQL DDL matching the schema.
   - Update `ensureKanbanTable()` with the 3 new multi-tutor columns defensively.
   - Add unit tests for `onModuleInit()` and `ensureTimelineTable()` in `apps/backend/src/tutoria/tutoria.service.spec.ts`.
4. **Verification**:
   - Run TypeScript typecheck: `npx tsc --noEmit -p apps/backend/tsconfig.json`
   - Run backend build: `npm run build --prefix apps/backend`
   - Run unit tests: `npm run test --prefix apps/backend -- tutoria.service.spec.ts`
   - Document commands, outputs, and exit codes in `handoff.md`.

## Output Requirements
Write your completion report in:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m1\handoff.md`
Then notify the sub-orchestrator.

## 2026-11-10T20:39:57Z
You are Worker M1 (Backend Schema & Migrations Implementation).
Read your full dispatch instructions at:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m1\DISPATCH.md`

