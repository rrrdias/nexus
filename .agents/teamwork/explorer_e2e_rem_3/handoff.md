# Remediation Investigation Report: Adversarial Gaps & Domain Invariant Enforcement in Multi-Tutor Backend Suite

**Agent**: Explorer E2E Remediation 3 (`explorer_e2e_rem_3`)  
**Archetype**: TEAMWORK EXPLORER  
**Roles**: investigator, synthesizer  
**Track**: E2E Testing Track (Multi-Tutor Hybrid Attendance, Timeline & Audit Trail)  
**Target Files**: 
- `apps/backend/src/tutoria/tutoria.service.ts`
- `apps/backend/src/tutoria/tutoria.controller.ts`
- `apps/backend/src/tutoria/tutoria.service.spec.ts`
- `apps/backend/test/tutoria-multitutor.e2e-spec.ts`  
**State Folder**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_3`  
**Date**: 2026-11-10T21:30:00Z  

---

## 1. Observation

### 1.1 Direct Inspection of Challenger 1 Finding (`ADV-BATON-02` and `ADV-BATON-03`)
In `.agents/teamwork/challenger_e2e_1/handoff.md`, Challenger 1 reported:
> "Probing `POST /api/tutoria/kanban/:id/transferir` with `novoTutorId: 'inactive-tutor-8'` (`isActive = false`):  
> `ADV-BATON-02 Result status for inactive tutor transfer: 200`  
> **Empirical Bug Confirmed**: The endpoint returns HTTP 200 OK and assigns the student to an inactive tutor who cannot log in."  
>  
> "Source code analysis of `transferirTutoriaBastao` (lines 631-636):  
> ```typescript
> const targetTutor = this.testDb._state.users.get(body.novoTutorId);
> if (!targetTutor) {
>   throw new NotFoundException(`Novo tutor ${body.novoTutorId} não encontrado.`);
> }
> ```  
> The endpoint only verifies that the user ID exists in the user table, without validating `targetTutor.isActive === true` or `targetTutor.modules.includes('tutoria')`."

### 1.2 Inspection of the In-Test Facade in `apps/backend/test/tutoria-multitutor.e2e-spec.ts`
Inspection of `apps/backend/test/tutoria-multitutor.e2e-spec.ts` confirmed the root cause:
1. Lines 499–660 implement an in-test controller `TutoriaMultiTutorE2EController`.
2. Lines 631–642 handle baton pass:
   ```typescript
   const targetTutor = this.testDb._state.users.get(body.novoTutorId);
   if (!targetTutor) {
     throw new NotFoundException(
       `Novo tutor ${body.novoTutorId} não encontrado.`,
     );
   }

   if (card.tutor_responsavel_id === body.novoTutorId) {
     throw new BadRequestException(
       'O discente já está atribuído a este tutor.',
     );
   }
   ```
3. Lines 2280–2334 implement only 5 boundary tests under `Feature F5 Boundary Cases`:
   - `TC-T2-F5-01`: Non-existent `novoTutorId` (`tutor-fantasma-999`) -> 404
   - `TC-T2-F5-02`: Malformed UUID (`abc`) -> 400
   - `TC-T2-F5-03`: Empty `notaTransicao` (`""`) -> 400
   - `TC-T2-F5-04`: Whitespace-only `notaTransicao` (`"   "`) -> 400
   - `TC-T2-F5-05`: Self-transfer to current owner -> 400
4. **Missing Coverage**: The test suite completely lacked any test verifying the rejection of transfers targeting inactive tutors (`isActive: false`).

### 1.3 Inspection of Genuine Production `TutoriaService.transferirTutor`
Direct inspection of `apps/backend/src/tutoria/tutoria.service.ts` at lines 1298–1322 revealed that production code **ALREADY enforces active tutor validation**:
```typescript
    if (!dto.novoTutorId || dto.novoTutorId.trim().length < 5) {
      throw new BadRequestException('ID do novo tutor inválido ou ausente.');
    }
    const novoTutorId = dto.novoTutorId.trim();

    const targetUserRows = await this.db.execute(sql`
      SELECT id, name, email, "isActive"
      FROM "user"
      WHERE id = ${novoTutorId}
      LIMIT 1;
    `);

    if (targetUserRows.length === 0) {
      throw new NotFoundException(`Novo tutor ${novoTutorId} não encontrado.`);
    }

    if (!targetUserRows[0].isActive) {
      throw new BadRequestException('Tutor selecionado está inativo.');
    }

    if (card.tutor_responsavel_id === novoTutorId) {
      throw new BadRequestException(
        'O discente já está atribuído a este tutor.',
      );
    }
```
Furthermore, `TutoriaService` correctly validates:
- Target tutor existence: `targetUserRows.length === 0` -> `NotFoundException` (HTTP 404).
- Target tutor active state: `!targetUserRows[0].isActive` -> `BadRequestException('Tutor selecionado está inativo.')` (HTTP 400).
- Idempotent self-transfer: `card.tutor_responsavel_id === novoTutorId` -> `BadRequestException('O discente já está atribuído a este tutor.')` (HTTP 400).
- Mandatory pedagogical note: `!dto.notaTransicao || dto.notaTransicao.trim().length < 5` -> `BadRequestException('A nota de transição é obrigatória (mínimo de 5 caracteres).')` (HTTP 400).

### 1.4 Verification of Unit Test Suite (`tutoria.service.spec.ts`)
Execution of the backend unit test suite:
```powershell
npm test --workspace=@nexus-core/backend -- tutoria.service.spec.ts
```
**Verbatim Output**:
```text
PASS src/tutoria/tutoria.service.spec.ts
  TutoriaService
    transferirTutor (Passagem de Bastão)
      √ should transfer card ownership to new tutor and create passagem_bastao event (2 ms)
      √ should throw NotFoundException when card does not exist for transfer (1 ms)
      √ should throw NotFoundException when target tutor does not exist (2 ms)
      √ should throw BadRequestException when target tutor is inactive (2 ms)
      √ should throw BadRequestException when target tutor is already current owner (3 ms)
      √ should throw BadRequestException when transition note is too short (< 5 chars) (2 ms)

Test Suites: 1 passed, 1 total
Tests:       31 passed, 31 total
Time:        2.274 s
```
Lines 595–603 of `tutoria.service.spec.ts` prove that the production service actively rejects inactive tutors.

### 1.5 Inspection of Collaborator Ownership Invariant in `updateKanbanCard`
Direct inspection of `apps/backend/src/tutoria/tutoria.service.ts` lines 928–1010 confirmed that the unconditional overwrite `updates.push(sql`tutor_responsavel_id = ${tutorId}`)` previously flagged by Auditor 1 and Challenger 1 **has been removed in production**. Collaborator movements and note edits update only `status_kanban`, `observacoes`, `canal_contato_utilizado`, `ultimo_contato_em`, and append an audit event to `tutoria_atendimentos_historico` without touching `tutor_responsavel_id`.

---

## 2. Logic Chain

1. **Step 1 — Disconnect Between Production and E2E Test Suite**:
   The domain invariant breach identified by Challenger 1 (`ADV-BATON-02` returning HTTP 200 for inactive tutors) occurred **solely because the E2E test harness routed requests through `TutoriaMultiTutorE2EController`**, an in-test facade that omitted the `targetTutor.isActive` check. The genuine production service (`TutoriaService.transferirTutor`) already has this check implemented and verified by unit tests (Observation 1.3 & 1.4).

2. **Step 2 — Eliminating the Facade Restores Genuine Validation**:
   When `TutoriaMultiTutorE2EController` is removed and the test harness mounts `controllers: [TutoriaController]` with genuine `TutoriaService`, Supertest requests to `POST /api/tutoria/kanban/:id/transferir` will execute `TutoriaService.transferirTutor`.

3. **Step 3 — Stateful Mock DB Requirements for Target Tutor Query**:
   `TutoriaService.transferirTutor` executes:
   ```sql
   SELECT id, name, email, "isActive" FROM "user" WHERE id = ${novoTutorId} LIMIT 1;
   ```
   In `createMockTutoriaDatabase()`, `users` map already contains `inactive-tutor-8`:
   ```typescript
   ['inactive-tutor-8', { id: 'inactive-tutor-8', name: 'Tutor Desativado', email: 'inativo@unievangelica.edu.br', isActive: false, isSuperAdmin: false, modules: ['tutoria'] }]
   ```
   When `mockDb.execute` receives this query with `inactive-tutor-8`, it returns the record with `isActive: false`. `TutoriaService` evaluates `!targetUserRows[0].isActive` and throws `BadRequestException('Tutor selecionado está inativo.')`, producing HTTP 400.

4. **Step 4 — Domain Invariant Completeness via Explicit Test Cases**:
   To ensure that regression can never recur and that the E2E suite satisfies Challenger 1's invariant requirements, two explicit test cases must be added to Tier 2 (Feature F5 Boundary Cases):
   - `TC-T2-F5-06`: Explicitly asserts HTTP 400 Bad Request with message `'Tutor selecionado está inativo.'` when transferring to `inactive-tutor-8`.
   - `TC-T2-F5-07`: Explicitly asserts HTTP 404 Not Found with message containing `'não encontrado'` when transferring to a non-existent tutor ID.

5. **Step 5 — 4-Tier Matrix Integrity**:
   With these additions, the backend test matrix spans:
   - Tier 1: 35 category-partition happy paths (5 tests x 7 features)
   - Tier 2: 37 boundary & corner cases (5 tests x 6 features + 7 tests for F5)
   - Tier 3: 8 cross-feature sequential and interaction tests
   - Tier 4: 5 real-world multi-tutor pedagogical workload scenarios
   - Total: **85 genuine E2E tests**, 0 in-test facades, 100% exercising production `TutoriaController` and `TutoriaService`.

---

## 3. Caveats

1. **User Role Authorization Scope**:
   In the PostgreSQL schema (`apps/backend/src/db/schema.ts`), the `"user"` table does not contain a `role` column; module authorization is governed by the `users_system_access` table and verified at the HTTP boundary via `RbacGuard`. `TutoriaService.transferirTutor` validates existence and `isActive = true`. Users in the system are academic tutors/staff; non-tutor discentes do not exist in the `"user"` table (discente data is populated via Lyceum API sync in `tutoria_atendimentos_kanban`).
2. **Mock Database SQL Matching**:
   When `mockDb.execute` runs against `TutoriaService`, it must accurately inspect raw SQL templates generated by Drizzle's `sql` tagged template literals. Specifically, string matching on `WHERE id =` or parsing `queryChunks` must handle both parameterized values and concatenated strings.

---

## 4. Conclusion & Actionable Specification

### 4.1 Verdict
**REMEDIATION READY**. The domain invariant breach reported by Challenger 1 is fully understood. The production business logic is already sound; the remediation requires removing the in-test facade, rewiring `tutoria-multitutor.e2e-spec.ts` to `TutoriaController`, and adding test cases `TC-T2-F5-06` and `TC-T2-F5-07`.

### 4.2 Exact Formulation of Remediation Test Cases

Insert the following test cases into `apps/backend/test/tutoria-multitutor.e2e-spec.ts` inside `describe('Feature F5 Boundary Cases', ...)` immediately after `TC-T2-F5-05` (around line 2334):

```typescript
      it('TC-T2-F5-06: Reject baton pass targeting an inactive tutor -> 400 Bad Request ("Tutor selecionado está inativo.")', async () => {
        const res = await client
          .post(`/api/tutoria/kanban/${cardF5Bva}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'inactive-tutor-8',
            notaTransicao: 'Tentativa de transferir para tutor desativado',
          })
          .expect(400);

        expect(res.body).toBeDefined();
        expect(res.body.statusCode).toBe(400);
        expect(res.body.message).toContain('Tutor selecionado está inativo.');
      });

      it('TC-T2-F5-07: Reject baton pass targeting a non-existent tutor with explicit error message -> 404 Not Found', async () => {
        const res = await client
          .post(`/api/tutoria/kanban/${cardF5Bva}/transferir`)
          .set('Authorization', `Bearer ${tokenLeadTutor}`)
          .send({
            novoTutorId: 'tutor-inexistente-404-uuid',
            notaTransicao: 'Tentativa de transferir para usuário inexistente',
          })
          .expect(404);

        expect(res.body).toBeDefined();
        expect(res.body.statusCode).toBe(404);
        expect(res.body.message).toContain('não encontrado');
      });
```

### 4.3 Summary of 4-Tier Test Matrix Post-Remediation

| Tier | Category | Features Covered | Test Count | System Under Test |
|---|---|---|:---:|---|
| **Tier 1** | Feature Coverage (Happy Paths) | F1, F2, F3, F4, F5, F6, F7 | 35 | Production `TutoriaController` + `TutoriaService` |
| **Tier 2** | Boundary Value Analysis & Invariants | F1, F2, F3, F4, F5, F6, F7 | 37 | Production `TutoriaController` + `TutoriaService` |
| **Tier 3** | Cross-Feature Interactions | F1+F2+F3+F4+F5+F6+F7 | 8 | Production `TutoriaController` + `TutoriaService` |
| **Tier 4** | Real-World Pedagogical Scenarios | End-to-end multi-tutor journeys | 5 | Production `TutoriaController` + `TutoriaService` |
| **Total** | **Comprehensive Genuine Backend E2E** | **All Requirements R1-R4** | **85** | **Zero in-test facades** |

---

## 5. Verification Method

To independently reproduce and verify this remediation:

1. **Verify Unit Test Validation in Production Service**:
   ```powershell
   npm test --workspace=@nexus-core/backend -- tutoria.service.spec.ts
   ```
   *Expected Result*: 31 passed tests, including `'should throw BadRequestException when target tutor is inactive'`.

2. **Verify SQL Check in `TutoriaService.transferirTutor`**:
   ```powershell
   Select-String -Path "apps\backend\src\tutoria\tutoria.service.ts" -Pattern "Tutor selecionado está inativo"
   ```
   *Expected Result*: Matches line 1315 of `apps/backend/src/tutoria/tutoria.service.ts`.

3. **Verify Execution of Genuine E2E Test Suite (Post-Wiring)**:
   After worker removes `TutoriaMultiTutorE2EController`, mounts `TutoriaController`, and includes `TC-T2-F5-06` / `TC-T2-F5-07`:
   ```powershell
   npm run test:e2e --workspace=@nexus-core/backend -- tutoria-multitutor.e2e-spec.ts
   ```
   *Expected Result*: 85 passed, 0 failed, 0 facade classes, runtime < 3 seconds.