# BRIEFING — 2026-11-10T21:10:15Z

## Mission
Investigate TutoriaService in apps/backend/src/tutoria/tutoria.service.ts and formulate the implementation strategy for the hybrid ownership model, intervention recording, baton passing, consolidated timeline, and active tutors query.

## 🔒 My Identity
- Archetype: explorer
- Roles: read-only investigation, analysis, strategy formulation
- Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
- State folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m2_1
- Original parent: 7eeca256-7483-44cc-8dd1-1e2137a194ab
- Milestone: Milestone 2 (Backend Tutoria APIs & Hybrid Ownership)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / do NOT modify source code
- Produce structured handoff report in state folder: `handoff.md`
- Maintain progress updates in `progress.md`

## Current Parent
- Conversation ID: 7eeca256-7483-44cc-8dd1-1e2137a194ab
- Updated: 2026-11-10T21:03:45Z

## Investigation State
- **Explored paths**:
  - `apps/backend/src/tutoria/tutoria.service.ts`
  - `apps/backend/src/tutoria/tutoria.controller.ts`
  - `apps/backend/src/tutoria/tutoria.service.spec.ts`
  - `apps/backend/src/tutoria/dto/` (`create-kanban-card.dto.ts`, `update-kanban-card.dto.ts`, `engagement-filter.dto.ts`, `kanban-filter.dto.ts`)
  - `apps/backend/src/db/schema.ts` (specifically lines 14-30 `users`, 763-810 `tutoriaAtendimentosKanban`, 813-858 `tutoriaAtendimentosHistorico`, relations and types)
  - `apps/backend/src/auth/jwt-auth.guard.ts` (lines 58-102) & `auth.service.ts` (lines 90-125)
  - `apps/backend/src/auth/rbac.guard.ts` (lines 80-160)
  - `apps/backend/test/tutoria-multitutor.e2e-spec.ts` (contract definitions, SQL simulation mock router, 83 test cases across Tiers 1-4)
- **Key findings**:
  1. `updateKanbanCard` contains the ownership overwrite bug at lines 928-939 (`updates.push(sql'tutor_responsavel_id = ${tutorId}')`), which strips primary ownership whenever an authenticated user moves a card or adds notes. Must be removed; only `transferirTutor` may mutate `tutor_responsavel_id`.
  2. `updateKanbanCard` currently fails to record any history event into `tutoria_atendimentos_historico` and does not update `ultima_intervencao_em` or `qtd_intervencoes`.
  3. `req.user` in NestJS only contains `{ id, email, isSuperAdmin, isDisabled }` because `JwtAuthGuard` does not include `name`. `resolveTutorInfo` with DB query against `"user"` and in-memory TTL caching is essential to guarantee `autorNome` is populated.
  4. `registrarIntervencao` must support both `atendimentoId` and auto-lookup by `matricula` + `periodo`, updating card metrics (`ultima_intervencao_em = now()`, `qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1`).
  5. `transferirTutor` requires verifying card existence, verifying new tutor existence/activity, preventing re-assignment to existing owner, validating `notaTransicao >= 5 chars`, updating card owner, and inserting a `passagem_bastao` audit row.
  6. `getTimelineAluno` queries `tutoria_atendimentos_historico` by `matricula` (and optional `atendimentoId`), ordered `createdAt ASC`. Includes a synthetic fallback `abertura` event from `tutoria_atendimentos_kanban` for legacy cards with zero history rows.
  7. `getTutoresAtivos` queries `SELECT id, name, email FROM "user" WHERE "isActive" = true ORDER BY name ASC;`, matching both the mock test router and production requirements.
- **Unexplored areas**: None within backend TutoriaService scope.

## Key Decisions Made
- Formulate precise, ready-to-implement code recipes and DTO specifications for Worker (`worker_m2_1`).
- Map all 83 E2E test assertions to backend implementation details.

## Artifact Index
- `.agents/teamwork/explorer_m2_1/DISPATCH.md` — Incoming dispatch message
- `.agents/teamwork/explorer_m2_1/BRIEFING.md` — Agent briefing & working memory
- `.agents/teamwork/explorer_m2_1/progress.md` — Liveness & task progress
- `.agents/teamwork/explorer_m2_1/handoff.md` — Comprehensive analysis and implementation plan
