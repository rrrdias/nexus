# Task Assignment: Reviewer 2 (Migrations, Bootstrap & Test Coverage)

## Mission
Independently review the Milestone 1 implementation of migration scripts, package.json scripts, runtime bootstrap in `TutoriaService`, and unit tests.
Verify correctness, completeness, robustness, and interface conformance.

## Authoritative Context Documents
- ORIGINAL_REQUEST: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT_DEFINITION: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- MILESTONE_SCOPE: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m1\SCOPE.md`
- Worker M1 Handoff: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m1\handoff.md`

## Review Focus
1. Inspect `apps/backend/src/db/migrate-tutoria-multitutor.ts`:
   - Idempotency (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
   - Quoting of `"user"`, `"sourceInstitution"`, `"createdAt"`.
   - Process exit codes and error handling.
2. Inspect `apps/backend/package.json`:
   - Registration of `"db:migrate-tutoria-multitutor"` and prod variant.
3. Inspect `apps/backend/src/tutoria/tutoria.service.ts`:
   - `ensureTimelineTable()` implementation, error handling, in-memory flag `hasEnsuredTimelineTable`, call from `onModuleInit()`.
4. Inspect unit tests in `apps/backend/src/tutoria/tutoria.service.spec.ts`:
   - Verification that unit tests genuinely exercise `onModuleInit()` and `ensureTimelineTable()`.
5. Run build and tests:
   - `npm run test --prefix apps/backend -- tutoria.service.spec.ts`
   - `npm run build --prefix apps/backend`

## Output Requirements
Write your review report and explicit verdict (`APPROVE` or `REQUEST_CHANGES`) to `handoff.md` in your state folder:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\reviewer_m1_2\handoff.md`
Then notify the sub-orchestrator.
