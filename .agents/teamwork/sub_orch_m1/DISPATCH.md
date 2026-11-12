# DISPATCH — Sub-Orchestrator Milestone 1 (Backend Schema & Migrations)

## Mission
Orchestrate and deliver Milestone 1: Backend Data Model, Schema, and Migration Strategy for Multi-Tutor Support and Audit Trail.

## Scope
- Project scope document: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- Original user request: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- State folder: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m1`
- Working directory: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
- Survey report backend: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_survey_1\handoff.md`

## Deliverables
1. Update `apps/backend/src/db/schema.ts`:
   - Define `tutoriaAtendimentosHistorico` (`tutoria_atendimentos_historico`) with all necessary fields (`id`, `atendimentoId`, `matricula`, `periodo`, `sourceInstitution`, `tipoEvento`, `autorId`, `autorNome`, `tutorResponsavelAnteriorId`, `tutorResponsavelNovoId`, `estadoAnterior`, `estadoNovo`, `canalContato`, `observacoes`, `metadata`, `createdAt`).
   - Add required relations and indexes (`idx_tutoria_hist_atendimento`, `idx_tutoria_hist_matricula`, `idx_tutoria_hist_created_at`, `idx_tutoria_hist_tipo`).
   - Add colunas adicionais em `tutoriaAtendimentosKanban` (`tutorIniciadorId`, `ultimaIntervencaoEm`, `qtdIntervencoes`).
2. Create migration script:
   - `apps/backend/src/db/migrate-tutoria-multitutor.ts` using idempotent SQL DDL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
   - Register script in `apps/backend/package.json` (`"db:migrate-tutoria-multitutor"`).
3. Update `TutoriaService.onModuleInit()`:
   - Add `ensureTimelineTable()` with idempotent SQL execution so runtime boot and test environments automatically create the audit trail table.
4. Execute and verify TypeScript compilation (`tsc --noEmit`), backend build, and migration script.

## Iteration Loop
Run the Explorer -> Worker -> Reviewer -> Challenger -> Auditor cycle.
Ensure forensic integrity audit passes before approving the milestone.
When complete, write `handoff.md` in your state folder and send a completion message to parent.


## 2026-11-10T20:28:58Z
You are sub_orchestrator for Milestone 1 (Backend Schema & Migrations) of nexus-core.
Your mission is to orchestrate the implementation and verification of the backend Drizzle schema updates, migration script, and runtime table bootstrap for the multi-tutor audit trail.

Read your full dispatch instructions at:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m1\DISPATCH.md`
And the project definition at:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
And the original request at:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`

Your working directory is:
`c:\Users\ricardo.dias\develop\projetos\nexus-core`
Your state folder is:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m1`

Follow the orchestrator procedure: Assess -> Iteration Loop (Explorer -> Worker -> Reviewer -> Challenger -> Auditor) -> Gate.
Ensure a clean build and forensic integrity audit before approving.
Update your `progress.md` and write your `handoff.md` upon completion, then send a message back to the parent orchestrator (conversation ID 41677f55-1bb4-43a4-8ea4-f075d563de44).
