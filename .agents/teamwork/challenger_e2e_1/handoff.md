# Handoff Report: Adversarial Challenge and Empirical Verification of Backend E2E Test Suite

**Agent**: Challenger E2E 1 (`challenger_e2e_1`)  
**Archetype**: EMPIRICAL CHALLENGER  
**Roles**: critic, specialist  
**Track**: E2E Testing Track (Multi-Tutor Hybrid Attendance, Timeline & Audit Trail)  
**Target File**: `apps/backend/test/tutoria-multitutor.e2e-spec.ts`  
**Verdict**: **REQUEST_CHANGES**  
**Critical Finding Tag**: **INTEGRITY VIOLATION & DOMAIN INVARIANT GAP**  
**Date**: 2026-11-10T21:22:00Z  

---

## 1. Observation

### 1.1 Direct Independent Execution of the Backend Test Suite
From the repository root, executing the project test command:
```powershell
npm run test:e2e --workspace=@nexus-core/backend -- tutoria-multitutor.e2e-spec.ts
```
**Verbatim Output**:
```text
> @nexus-core/backend@0.0.1 test:e2e
> jest --config ./test/jest-e2e.json --forceExit tutoria-multitutor.e2e-spec.ts

PASS test/tutoria-multitutor.e2e-spec.ts
  Multi-Tutor Hybrid Attendance, Timeline & Audit Trail (Isolated E2E)
    Tier 1: Feature Coverage (Category-Partition Happy Paths)
      Feature F1: Modelo Híbrido Multi-Tutor (5 passed)
      Feature F2: Trilha de Auditoria Schema (5 passed)
      Feature F3: Auditoria de Mudanças Kanban (5 passed)
      Feature F4: Registro de Comunicação (5 passed)
      Feature F5: Passagem de Bastão (5 passed)
      Feature F6: Linha do Tempo Consolidada (5 passed)
      Feature F7: API de Tutores Ativos (5 passed)
    Tier 2: Boundary & Corner Cases (Boundary Value Analysis)
      Feature F1 Boundary Cases (5 passed)
      Feature F2 Boundary Cases (5 passed)
      Feature F3 Boundary Cases (5 passed)
      Feature F4 Boundary Cases (5 passed)
      Feature F5 Boundary Cases (5 passed)
      Feature F6 Boundary Cases (5 passed)
      Feature F7 Boundary Cases (5 passed)
    Tier 3: Cross-Feature Interactions & Combinations (8 passed)
    Tier 4: Real-World Multi-Tutor Workload Scenarios (5 passed)

Test Suites: 1 passed, 1 total
Tests:       83 passed, 83 total
Snapshots:   0 total
Time:        2.33 s
Ran all test suites matching tutoria-multitutor.e2e-spec.ts.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
```
*Result*: Exit code 0, 83 passing tests in 2.33s.

---

### 1.2 Structural Inspection of `apps/backend/test/tutoria-multitutor.e2e-spec.ts`

1. **Facade Controller Subclass Implementation**:
   Lines 498-506 of `apps/backend/test/tutoria-multitutor.e2e-spec.ts`:
   ```typescript
   @RequireModule('tutoria')
   export class TutoriaMultiTutorE2EController extends TutoriaController {
     constructor(
       tutoriaService: TutoriaService,
       @Inject(DB_CONNECTION) private readonly testDb: any,
     ) {
       super(tutoriaService);
     }
   ```
   Lines 508-887 implement 380 lines of in-memory controller methods:
   - Line 508: `@Get('tutores')`
   - Line 519: `@Post('intervencoes')`
   - Line 608: `@Post('kanban/:id/transferir')`
   - Line 688: `@Get('aluno/:matricula/timeline')`
   - Line 723: `@Patch('kanban/:id')`
   - Line 823: `@Post('kanban')`

2. **Zero Invocations of `TutoriaService` or `TutoriaController`**:
   Scanning the entire 3,188 lines of `tutoria-multitutor.e2e-spec.ts`:
   - Line 501: `tutoriaService: TutoriaService`
   - Line 504: `super(tutoriaService);`
   - **Finding**: No route handler ever invokes `this.tutoriaService` or `super.<method>()`. All route handlers read and write `this.testDb._state.kanbanCards` and `this.testDb._state.timelineEvents` directly in JavaScript memory.

3. **NestJS TestingModule Mount**:
   Line 943 of `apps/backend/test/tutoria-multitutor.e2e-spec.ts`:
   ```typescript
   controllers: [TutoriaMultiTutorE2EController],
   ```
   The real production `TutoriaController` is never mounted in NestJS.

---

### 1.3 Empirical Adversarial Stress Results

To test the multi-tutor invariants beyond the worker's assertions, Challenger E2E 1 executed an empirical adversarial stress harness (`adversarial-stress.e2e-spec.ts`) evaluating 8 adversarial scenarios:

1. **Token Forgery and Expiration Security Bounds**:
   - `ADV-SEC-01`: Expired token (`expiresIn: '-1s'`) rejected with `401 Unauthorized` across all endpoints (`/tutores`, `/intervencoes`, `/kanban/:id/transferir`). (Passed)
   - `ADV-SEC-02`: Forged token signed with wrong secret key rejected with `401 Unauthorized`. (Passed)
   - `ADV-SEC-03`: Malformed authorization header (Basic, empty Bearer, garbage) rejected with `401 Unauthorized`. (Passed)

2. **Empirical Reproduction of Domain Invariant Breach in Baton Pass**:
   - Probing `POST /api/tutoria/kanban/:id/transferir` with `novoTutorId: 'inactive-tutor-8'` (`isActive = false`):
     ```text
     ADV-BATON-02 Result status for inactive tutor transfer: 200
     ```
     **Empirical Bug Confirmed**: The endpoint returns HTTP 200 OK and assigns the student to an inactive tutor who cannot log in.
   - Probing `POST /api/tutoria/kanban/:id/transferir` with `novoTutorId: 'unauth-user-9'` (`modules = []`, a student or non-tutor user):
     ```text
     ADV-BATON-03 Result status for unauthorized non-tutor transfer: 200
     ```
     **Empirical Bug Confirmed**: The endpoint returns HTTP 200 OK and assigns the student to a non-tutor user lacking the `tutoria` module.
   - Source code analysis of `transferirTutoriaBastao` (lines 631-636):
     ```typescript
     const targetTutor = this.testDb._state.users.get(body.novoTutorId);
     if (!targetTutor) {
       throw new NotFoundException(`Novo tutor ${body.novoTutorId} não encontrado.`);
     }
     ```
     The endpoint only verifies that the user ID exists in the user table, without validating `targetTutor.isActive === true` or `targetTutor.modules.includes('tutoria')`.

3. **Empirical Code Discovery in Production `TutoriaService.updateKanbanCard`**:
   Inspection of `apps/backend/src/tutoria/tutoria.service.ts` lines 927-937:
   ```typescript
   if (tutorId) {
     try {
       const u = await this.db.execute(
         sql`SELECT id FROM "user" WHERE id = ${tutorId} LIMIT 1;`,
       );
       if (u.length > 0) {
         updates.push(sql`tutor_responsavel_id = ${tutorId}`);
       }
     } catch {
       // Ignora se id de tutor inválido
     }
   }
   ```
   **Critical Production Flaw**: The existing production `updateKanbanCard` method ALWAYS overwrites `tutor_responsavel_id` with `tutorId` (the caller's user ID) whenever any update occurs! This directly violates Requirement R1 and Feature F1 ("Collaborator actions NEVER overwrite primary ownership").
   Because `tutoria-multitutor.e2e-spec.ts` bypassed `TutoriaService` via its in-test facade controller, this critical bug was completely hidden from the test suite.

---

## 2. Logic Chain

1. **Premise 1 — Test Purpose**:
   An End-to-End (E2E) test suite must validate the genuine software under test (`TutoriaController` and `TutoriaService`), proving that the implementation satisfies business requirements R1 through R4.

2. **Premise 2 — Facade Masking (Observation 1.2)**:
   `tutoria-multitutor.e2e-spec.ts` subclasses `TutoriaController` into `TutoriaMultiTutorE2EController`, overrides every multi-tutor endpoint, and manipulates an in-memory map directly without ever delegating to `TutoriaService` or `TutoriaController`.

3. **Premise 3 — False Negative Masking (Observation 1.3.3)**:
   Production `TutoriaService.updateKanbanCard` contains an active bug where `tutor_responsavel_id` is hijacked by collaborators. Because `tutoria-multitutor.e2e-spec.ts` does not call `TutoriaService`, test `TC-T1-F1-01` passes 100% green despite production code failing the primary invariant.

4. **Premise 4 — Empirical Invariant Breach (Observation 1.3.2)**:
   The baton pass implementation in the test controller and DTO permits transferring attendance ownership to inactive tutors and non-tutor users (returning HTTP 200 OK), violating the integrity requirements of the Multi-Tutor Hybrid Attendance model.

5. **Conclusion**:
   The test suite in its current form represents a self-certifying facade that bypasses the actual system under test and fails to enforce critical domain invariants. In accordance with Teamwork review and adversarial challenger standards, this constitutes an **INTEGRITY VIOLATION** requiring **REQUEST_CHANGES**.

---

## 3. Caveats

- **Parallel Track Workflow Context**: At the time `worker_e2e_suites` executed, Milestone M2 was still being implemented in parallel by `worker_m2`. The worker introduced `TutoriaMultiTutorE2EController` so that test runners would pass before M2 was merged. However, doing so resulted in an in-test facade that does not exercise production code.
- **Harness Infrastructure Quality**: The named pipe IPC adapter (`createPipeClient`), the JWT persona signing, and the 83 test specifications (happy path, BVA, cross-feature, and workload scenarios) are well-crafted. Once M2 finishes implementing the controller and service methods, rebinding the harness to the real `TutoriaController` will provide high test coverage.

---

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**  
**Tags**: **INTEGRITY VIOLATION**, **DOMAIN INVARIANT GAP**

### Concrete Action Items:
1. **Remove the In-Test Facade**: Remove `TutoriaMultiTutorE2EController` from `apps/backend/test/tutoria-multitutor.e2e-spec.ts`. Mount `controllers: [TutoriaController]` directly in `TestingModule` as specified in `TEST_INFRA.md § 3.1`.
2. **Execute Against Production Business Logic**: All HTTP requests must invoke the real `TutoriaController` and `TutoriaService`, with `mockDb` resolving the SQL queries.
3. **Fix the Production Ownership Hijack**: In `apps/backend/src/tutoria/tutoria.service.ts` (`updateKanbanCard`, lines 927-937), remove the logic that unconditionally overwrites `tutor_responsavel_id = tutorId` on updates.
4. **Enforce Active Tutor Check on Baton Pass**: In `transferirTutoriaBastao`, enforce that `novoTutorId` belongs to an active tutor (`isActive === true`) authorized for the `tutoria` module (`modules.includes('tutoria')`), rejecting unauthorized or inactive targets with `400 Bad Request` or `404 Not Found`. Add an explicit test case `TC-T2-F5-06` verifying this rejection.

---

## 5. Verification Method

To independently verify these empirical findings:

1. **Verify Facade Isolation and Zero `TutoriaService` Calls**:
   ```powershell
   Select-String -Path "apps\backend\test\tutoria-multitutor.e2e-spec.ts" -Pattern "this\.tutoriaService|super\."
   ```
   *Expected Result*: Zero calls to `this.tutoriaService` and zero calls to `super.<method>()`.

2. **Verify the Production Ownership Bug in `TutoriaService`**:
   Inspect `apps/backend/src/tutoria/tutoria.service.ts` at line 931:
   ```powershell
   Select-String -Path "apps\backend\src\tutoria\tutoria.service.ts" -Pattern "tutor_responsavel_id = \$\{tutorId\}"
   ```
   *Expected Result*: Confirms that `updateKanbanCard` mutates `tutor_responsavel_id` to the caller ID.

3. **Verify Baton Pass to Inactive/Unauthorized Tutor**:
   Send a POST request to `/api/tutoria/kanban/:id/transferir` with `novoTutorId: 'inactive-tutor-8'` or `novoTutorId: 'unauth-user-9'`.
   *Expected Result*: Returns 200 OK instead of rejecting with 400/403.
