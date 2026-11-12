# Progress — Worker E2E Remediation

Last visited: 2026-11-10T21:35:00Z
Status: In Progress

## Tasks
- [ ] Read mandatory inputs (Auditor handoff, Reviewer handoff, Challenger handoff, Explorer 1, 2, 3 Blueprints, TEST_INFRA.md, PROJECT.md)
- [ ] Inspect existing files:
  - `apps/backend/test/tutoria-multitutor.e2e-spec.ts`
  - `apps/backend/src/tutoria/tutoria.controller.ts`
  - `apps/backend/src/tutoria/tutoria.service.ts`
  - `apps/backend/src/tutoria/dto/create-kanban-card.dto.ts`
  - `apps/frontend/src/app/actions/tutoria.ts`
  - `apps/frontend/src/lib/tutoria-e2e.test.ts`
- [ ] Implement backend changes:
  - Update `CreateKanbanCardDto` and `TutoriaService` (optional `periodo`, audit log)
  - Refactor `tutoria-multitutor.e2e-spec.ts`: remove facade controller, mount `TutoriaController`, upgrade `mockDb`, add TC-T2-F5-06 and TC-T2-F5-07, clean server teardown
- [ ] Implement frontend changes:
  - Add 4 server actions to `apps/frontend/src/app/actions/tutoria.ts`
  - Create `apps/frontend/src/lib/tutoria-utils.ts`
  - Refactor `apps/frontend/src/lib/tutoria-e2e.test.ts` to use real actions/utils without fallbacks
- [ ] Verification:
  - Backend unit tests (`tutoria.service.spec.ts`)
  - Backend E2E tests (`tutoria-multitutor.e2e-spec.ts`)
  - Backend typecheck (`tsc --noEmit`)
  - Frontend E2E test (`tutoria-e2e.test.ts`)
  - Frontend typecheck (`tsc --noEmit`)
  - Linting
- [ ] Generate `handoff.md` and report completion to parent
