# DISPATCH — Explorer E2E 3 (Frontend Actions & TEST_INFRA.md Architecture)

## Mission
Investigate frontend server actions and utility test setups, specify the frontend E2E/integration test harness, and draft the complete `TEST_INFRA.md` specification.

## Inputs
- ORIGINAL_REQUEST.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- SCOPE.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_e2e_track\SCOPE.md`
- Working Directory: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
- State Folder: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_3`

## Specific Questions to Answer
1. How does `apps/frontend` handle server actions in `apps/frontend/src/app/actions/tutoria.ts` and how are tests structured in `apps/frontend/src/lib/*.test.ts` using `tsx`?
2. How to create an isolated frontend E2E test runner (`apps/frontend/src/lib/tutoria-e2e.test.ts` runnable via `npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts`) that verifies frontend actions, payload construction, error handling, and timeline data transformation?
3. Provide the full draft of `TEST_INFRA.md` following the template in `PROJECT.md` so that test runners, commands, and directory layouts are finalized.
4. Write your detailed handoff report to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_3\handoff.md`.
