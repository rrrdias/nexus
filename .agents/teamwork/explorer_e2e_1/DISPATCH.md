# DISPATCH — Explorer E2E 1 (Backend Harness & Isolated Runner)

## Mission
Investigate the backend test infrastructure in `apps/backend` and design the isolated E2E test runner harness for `TutoriaModule`.

## Inputs
- ORIGINAL_REQUEST.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- SCOPE.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_e2e_track\SCOPE.md`
- Working Directory: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
- State Folder: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_1`

## Specific Questions to Answer
1. How to create an isolated NestJS E2E test harness for `TutoriaModule` (`apps/backend/test/tutoria-multitutor.e2e-spec.ts` or similar) that boots `TutoriaModule` without failing on Redis (`connect EACCES 127.0.0.1:6379`) or Lyceum DB (`172.29.44.90:1433`)?
2. What providers need to be overridden (e.g. `DB_CONNECTION`, `CacheService`, authentication guards) to allow supertest requests or service/controller invocations to verify all endpoints:
   - `GET /api/tutoria/aluno/:matricula/timeline`
   - `POST /api/tutoria/intervencoes`
   - `POST /api/tutoria/kanban/:id/transferir`
   - `GET /api/tutoria/tutores`
   - `PATCH /api/tutoria/kanban/:id`
3. What is the exact npm/jest command to run this test suite?
4. Write your detailed handoff report to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_1\handoff.md`.


## 2026-11-10T20:30:54Z
You are Explorer 1 (Backend E2E Harness Explorer) for the E2E Testing Track of nexus-core.

MANDATORY INPUTS:
- Read ORIGINAL_REQUEST.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- Read PROJECT.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- Read SCOPE.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_e2e_track\SCOPE.md`
- Read DISPATCH.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_1\DISPATCH.md`

Your working directory is: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
Your state folder is: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_1`

TASK:
1. Read the input files.
2. Investigate how backend tests are run in `apps/backend` (check `apps/backend/package.json`, `apps/backend/test/`, `apps/backend/src/tutoria/`).
3. Design the isolated NestJS test harness for `TutoriaModule` that boots without external dependencies (no live Redis or Lyceum SQL Server) and can execute supertest HTTP requests or service calls to verify all Multi-Tutor endpoints (`POST /api/tutoria/intervencoes`, `POST /api/tutoria/kanban/:id/transferir`, `GET /api/tutoria/aluno/:matricula/timeline`, `GET /api/tutoria/tutores`, `PATCH /api/tutoria/kanban/:id`).
4. Detail the mock database fixture and query router required to verify attendance cards and historical timeline audit records.
5. Provide the exact test execution command.
6. Write your structured handoff report to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_1\handoff.md`.
7. Send a message to parent sub_orchestrator when done.
