# DISPATCH — Worker E2E Remediation (Genuine Production Binding & Invariant Enforcement)

## Mission
Refactor the backend and frontend E2E test suites to completely eliminate all in-test facades and fallbacks, binding 100% genuinely to production controllers, services, actions, and utilities.

## Mandatory Inputs (FULL AUDIT EVIDENCE & EXPLORER BLUEPRINTS)
- ORIGINAL_REQUEST.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- TEST_INFRA.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\TEST_INFRA.md`
- Full Auditor Evidence: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\auditor_e2e_1\handoff.md`
- Reviewer 1 Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\reviewer_e2e_1\handoff.md`
- Challenger 1 Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\challenger_e2e_1\handoff.md`
- Remediation Explorer 1 Blueprint: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_1\handoff.md`
- Remediation Explorer 2 Blueprint: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_2\handoff.md`
- Remediation Explorer 3 Blueprint: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_3\handoff.md`

## File Ownership
You exclusively own and modify:
- `apps/backend/test/tutoria-multitutor.e2e-spec.ts`
- `apps/backend/src/tutoria/dto/create-kanban-card.dto.ts`
- `apps/backend/src/tutoria/tutoria.service.ts`
- `apps/frontend/src/app/actions/tutoria.ts`
- `apps/frontend/src/lib/tutoria-utils.ts`
- `apps/frontend/src/lib/tutoria-e2e.test.ts`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Tasks
1. **Backend E2E Suite Refactoring (`apps/backend/test/tutoria-multitutor.e2e-spec.ts`)**:
   - Completely delete `TutoriaMultiTutorE2EController` (lines 498-887).
   - In `Test.createTestingModule`, mount `controllers: [TutoriaController]` directly.
   - Upgrade `mockDb.execute` per `explorer_e2e_rem_1/handoff.md` to interpret SQL from genuine `TutoriaService` (handling `ensureTimelineTable()`, cards, timeline events, active tutors, user queries).
   - Add test cases `TC-T2-F5-06` (inactive tutor rejection -> 400) and `TC-T2-F5-07` (non-existent tutor rejection -> 404).
   - Ensure named pipe server teardown awaits `server.close()` without open handles.
   - Align `apps/backend/src/tutoria/dto/create-kanban-card.dto.ts` and `apps/backend/src/tutoria/tutoria.service.ts` if needed for optional `periodo` and `'abertura'` audit logging.
2. **Frontend Production Files & Test Suite Refactoring**:
   - Add the 4 genuine Server Actions to `apps/frontend/src/app/actions/tutoria.ts` per `explorer_e2e_rem_2/handoff.md` (`getTutoriaTimeline`, `createTutoriaIntervencao`, `transferirTutoriaBastao`, `getTutoresAtivos`).
   - Create `apps/frontend/src/lib/tutoria-utils.ts` exporting `formatTimelineEventDate`, `groupTimelineEventsByDate`, `getAuthorBadge`, `validateBatonPassInput`, `TimelineEvent`, `ActiveTutor`.
   - Refactor `apps/frontend/src/lib/tutoria-e2e.test.ts` to import genuine Server Actions and utilities with ZERO in-test fallbacks and ZERO duplicate utility code.
3. **Execution & Verification**:
   - Run backend test suite: `npm run test:e2e --workspace=@nexus-core/backend -- tutoria-multitutor.e2e-spec.ts`
   - Run backend unit tests: `npm test --workspace=@nexus-core/backend -- tutoria.service.spec.ts`
   - Run frontend test suite: `npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts`
   - Run backend typecheck: `npm --workspace=@nexus-core/backend exec tsc -- --noEmit`
   - Run frontend typecheck: `npm --workspace=@nexus-core/frontend exec tsc -- --noEmit`
   - Verify linting.
4. **Handoff Report**:
   - Write your comprehensive report to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_e2e_remediation\handoff.md`.
   - Send completion message to parent sub_orchestrator.
