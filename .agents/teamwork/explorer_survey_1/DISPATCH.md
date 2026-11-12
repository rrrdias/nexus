# DISPATCH — Explorer Survey 1 (Backend Focus)

## Mission
Investigate the backend codebase (`apps/backend`) in preparation for architectural planning and implementation of multi-tutor support, hybrid ownership, attendance timeline, and audit trail in the NexusHub Tutoria module.

## Instructions
- Read `ORIGINAL_REQUEST.md` located at `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`.
- Examine `apps/backend/src/db/schema.ts` and related db files (Drizzle configuration, migrations, database provider, existing tables for discentes, atendimentos, tutores, mensagens, kanban).
- Examine `apps/backend/src/tutoria` (or equivalent module directory): controllers, services, DTOs, interfaces.
- Examine how authentication/authorization works in NestJS controllers (JWT, Request user object, current tutor id/name extraction).
- Investigate how transitions, interventions, messages, and kanban column moves are currently handled.
- Identify exact requirements for new schema tables (e.g. `atendimento_historico` / `tutoria_auditoria` / `intervencoes`), relations, foreign keys, indexes, and columns.
- Document all findings, current file paths, code snippets, and recommended implementation approach in your report.

## Output
Write your comprehensive report and findings to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_survey_1\handoff.md`.
Send a completion message back to the orchestrator with a summary.
