# DISPATCH — Worker E2E Suites (Implementation of Tiers 1-4 Test Suites)

## Mission
Implement the comprehensive E2E test suites for the Multi-Tutor Hybrid Attendance, Timeline, and Audit Trail subsystem according to `TEST_INFRA.md`.

## Mandatory References
- ORIGINAL_REQUEST.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- TEST_INFRA.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\TEST_INFRA.md`
- Explorer 1 Handoff (Backend Harness Blueprint): `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_1\handoff.md`
- Explorer 2 Handoff (4-Tier Test Matrix): `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_2\handoff.md`
- Explorer 3 Handoff (Frontend Harness Design): `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_3\handoff.md`

## File Ownership
You exclusively own and will create/modify:
- `apps/backend/test/tutoria-multitutor.e2e-spec.ts`
- `apps/frontend/src/lib/tutoria-e2e.test.ts`
- `apps/frontend/src/app/actions/api.ts` (only if necessary to add `process.env.TEST_AUTH_TOKEN` support for isolated test execution)

DO NOT modify files owned by backend/frontend implementation milestones (e.g. `schema.ts`, `tutoria.controller.ts`, `tutoria.service.ts`, `TutoriaTimeline.tsx`).

## Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Tasks
1. Read `TEST_INFRA.md`, `ORIGINAL_REQUEST.md`, and explorer handoffs.
2. Implement `apps/backend/test/tutoria-multitutor.e2e-spec.ts`:
   - Follow the isolated NestJS testing harness blueprint from `explorer_e2e_1/handoff.md` and `TEST_INFRA.md § 3.1`.
   - Implement test cases covering Tier 1 (TC-T1-F1 through F7), Tier 2 (boundary & corner cases TC-T2-F1 through F7), Tier 3 (cross-feature interactions TC-T3-INT-01 through 08), and Tier 4 (real-world scenarios TC-T4-SCN-01 through 05).
   - Ensure it runs deterministically with `npm run test:e2e --workspace=@nexus-core/backend -- tutoria-multitutor.e2e-spec.ts` (or `npx jest --config ./test/jest-e2e.json tutoria-multitutor.e2e-spec.ts --runInBand --forceExit`).
3. Implement `apps/frontend/src/lib/tutoria-e2e.test.ts`:
   - Follow `TEST_INFRA.md § 3.2` and `explorer_e2e_3/handoff.md`.
   - Ensure it tests Server Actions, payload construction, response parsing, error handling, and timeline grouping for F8.
   - Run it with `npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts` and ensure all tests pass.
4. Execute both test commands and document exact test counts, pass rates, and console output.
5. Write your handoff report to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_e2e_suites\handoff.md`.
6. Send completion message to parent sub_orchestrator.

## 2026-11-10T20:43:00Z
You are Worker E2E Suites for the E2E Testing Track of nexus-core.

MANDATORY INPUTS:
- Read ORIGINAL_REQUEST.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- Read PROJECT.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- Read TEST_INFRA.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\TEST_INFRA.md`
- Read DISPATCH.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_e2e_suites\DISPATCH.md`
- Read Explorer Handoffs:
  - `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_1\handoff.md`
  - `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_2\handoff.md`
  - `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_3\handoff.md`

Your working directory is: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
Your state folder is: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_e2e_suites`

WRITE OWNERSHIP:
You exclusively own and modify:
- `apps/backend/test/tutoria-multitutor.e2e-spec.ts`
- `apps/frontend/src/lib/tutoria-e2e.test.ts`
- `apps/frontend/src/app/actions/api.ts` (only if necessary for TEST_AUTH_TOKEN support)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK:
1. Implement `apps/backend/test/tutoria-multitutor.e2e-spec.ts` following the isolated NestJS testing harness blueprint in `TEST_INFRA.md § 3.1` and `explorer_e2e_1/handoff.md`. Cover Tiers 1-4 test cases (Features F1 through F7, boundary conditions, cross-feature combinations, and real-world scenarios).
2. Implement `apps/frontend/src/lib/tutoria-e2e.test.ts` following `TEST_INFRA.md § 3.2` and `explorer_e2e_3/handoff.md` covering Feature F8 (frontend server actions, response parsing, error handling, timeline formatting, baton pass validation).
3. Execute the tests:
   - Backend: `npm run test:e2e --workspace=@nexus-core/backend -- tutoria-multitutor.e2e-spec.ts` (or `npx jest --config ./test/jest-e2e.json tutoria-multitutor.e2e-spec.ts --runInBand --forceExit`)
   - Frontend: `npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts`
4. Document the exact test counts, execution logs, and pass results in your handoff report at `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_e2e_suites\handoff.md`.
5. Send a message to parent sub_orchestrator when finished.


## 2026-11-10T20:56:49Z
**Context**: E2E Test Suites Execution
**Content**: Your command `Run jest with BypassSandbox` is waiting for user elevation permission because BypassSandbox was set to true. Please execute `npx jest` or `npm run test:e2e` and `npx tsx` without `BypassSandbox` (or set `BypassSandbox: false`), as standard workspace test executions run normally in the sandbox without requiring elevation.
**Action**: Re-run your test commands with `BypassSandbox: false`, verify the test results, and complete your handoff.md.
