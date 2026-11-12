# Task Assignment: Forensic Integrity Auditor (Milestone 1)

## Mission
Conduct a comprehensive, independent forensic integrity audit of Milestone 1 changes.
Detect any integrity violations, cheating, facade implementations, hardcoding of test outputs, superficial mocks, or circumvention of real requirements.

## Authoritative Context Documents
- ORIGINAL_REQUEST: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT_DEFINITION: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- MILESTONE_SCOPE: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m1\SCOPE.md`
- Worker M1 Handoff: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m1\handoff.md`

## Audit Procedures
Perform the following checks:
1. **Static AST & Source Inspection**:
   - Inspect `apps/backend/src/db/schema.ts`, `apps/backend/src/db/migrate-tutoria-multitutor.ts`, `apps/backend/package.json`, `apps/backend/src/tutoria/tutoria.service.ts`, `apps/backend/src/tutoria/tutoria.service.spec.ts`.
   - Verify that tables and columns are defined authentically using Drizzle `pgTable`, `text`, `timestamp`, `integer`, `index`, `relations`.
   - Ensure no fake or dummy objects are exported.
2. **Hardcoding & Cheating Detection**:
   - Check if unit tests in `tutoria.service.spec.ts` genuinely test `onModuleInit()` and `ensureTimelineTable()` or if they use tautologies (`expect(true).toBe(true)`).
   - Check that SQL DDL in `migrate-tutoria-multitutor.ts` and `ensureTimelineTable()` actually issues DDL and contains authentic column definitions matching the schema.
3. **Execution Validation**:
   - Independently run TypeScript compilation (`npx tsc --noEmit -p apps/backend/tsconfig.json`).
   - Independently run the test suite (`npm run test --prefix apps/backend -- tutoria.service.spec.ts`).
   - Verify all test assertions pass with authentic logic.
4. **Referential Integrity & Boundary Checks**:
   - Verify FK targets (`users.id`, `tutoriaAtendimentosKanban.id`).
   - Check reserved keyword quoting (`"user"`).
   - Check case-sensitive identifier quoting (`"sourceInstitution"`, `"createdAt"`).

## Output Requirements
Write your forensic audit report and explicit verdict (`CLEAN` or `INTEGRITY VIOLATION`) to `handoff.md` in your state folder:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\auditor_m1\handoff.md`
Then notify the sub-orchestrator.


## 2026-11-10T20:50:53Z
You are the Forensic Integrity Auditor for Milestone 1.
Read your full dispatch instructions at:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\auditor_m1\DISPATCH.md`

Authoritative files to read:
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m1\SCOPE.md`
- Worker M1 handoff: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m1\handoff.md`

Your mission:
Conduct an independent forensic integrity audit of Milestone 1 changes across `apps/backend/src/db/schema.ts`, `apps/backend/src/db/migrate-tutoria-multitutor.ts`, `apps/backend/package.json`, `apps/backend/src/tutoria/tutoria.service.ts`, and `apps/backend/src/tutoria/tutoria.service.spec.ts`.
Perform:
1. Static analysis of schema and relation definitions (verify genuine Drizzle models, no dummy objects).
2. Hardcoding/cheating detection (verify unit tests assert real behavior and SQL DDL has genuine statements).
3. Independent compilation and test run (`npx tsc --noEmit -p apps/backend/tsconfig.json` and `npm run test --prefix apps/backend -- tutoria.service.spec.ts`).
4. Referential integrity and identifier check (`"user"`, `"sourceInstitution"`, `"createdAt"`).

Write your forensic audit report and explicit verdict (CLEAN or INTEGRITY VIOLATION) in:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\auditor_m1\handoff.md`
Then notify the sub-orchestrator.
