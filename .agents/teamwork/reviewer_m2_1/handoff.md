# Reviewer & Adversarial Critic Report: Milestone 2 — Backend Tutoria APIs & Hybrid Ownership

**Reviewer**: Reviewer 1 (`reviewer_m2_1`)  
**Target Milestone**: Milestone 2 (Backend Tutoria APIs & Hybrid Ownership)  
**Recipient**: Parent Orchestrator (`7eeca256-7483-44cc-8dd1-1e2137a194ab`) / `sub_orch_m2`  
**Timestamp**: 2026-11-10T21:35:45Z  
**Verdict**: **APPROVE**  
**Integrity Assessment**: **NO INTEGRITY VIOLATIONS DETECTED**

---

## 1. Observation

### 1.1 Reviewed Source Code Locations
The following implementation and test files were independently inspected line-by-line:
1. `apps/backend/src/tutoria/dto/create-intervencao.dto.ts` (61 lines)
   - Defines `CreateIntervencaoDto` with strict `class-validator` rules (`@IsNotEmpty`, `@IsString`, `@IsIn`, `@IsOptional`, `@Transform`).
   - Restricts `tipoEvento` to `TUTORIA_TIPOS_EVENTO` and `canalContato` to `TUTORIA_CANAIS_CONTATO`.
   - Handles empty string normalization for optional channels via `@Transform(({ value }) => (value === '' ? undefined : value))`.

2. `apps/backend/src/tutoria/dto/transferir-tutor.dto.ts` (14 lines)
   - Defines `TransferirTutorDto` with `@IsNotEmpty`, `@IsString` for `novoTutorId`.
   - Enforces `@MinLength(5, { message: 'A nota de transição deve conter no mínimo 5 caracteres.' })` on `notaTransicao`.

3. `apps/backend/src/tutoria/dto/update-kanban-card.dto.ts` (23 lines)
   - Defines `UpdateKanbanCardDto` with `@IsOptional`, `@IsString` on valid card properties (`statusKanban`, `observacoes`, `canalContatoUtilizado`, `ultimoContatoEm`, `dataResolucao`).
   - Notably omits `tutorResponsavelId`, guaranteeing that incoming card updates cannot tamper with ownership.

4. `apps/backend/src/tutoria/tutoria.controller.ts` (177 lines)
   - Secured with `@RequireModule('tutoria')` and routed at `api/tutoria`.
   - Endpoints exposed:
     - `GET tutores`: delegates to `this.tutoriaService.getTutoresAtivos()`.
     - `GET aluno/:matricula/timeline`: delegates to `this.tutoriaService.getTimelineAluno(matricula, atendimentoId)`.
     - `POST intervencoes` (`@HttpCode(HttpStatus.CREATED)`): extracts `req.user?.id` and `req.user?.name`, delegates to `this.tutoriaService.registrarIntervencao()`.
     - `POST kanban/:id/transferir` (`@HttpCode(HttpStatus.OK)`): extracts `req.user?.id` and `req.user?.name`, delegates to `this.tutoriaService.transferirTutor()`.
     - `PATCH kanban/:id`: delegates to `this.tutoriaService.updateKanbanCard()`.

5. `apps/backend/src/tutoria/tutoria.service.ts` (1530 lines)
   - Lines 46–83 (`resolveTutorInfo`): Resolves author name and email with an in-memory 60s TTL cache, ensuring snapshot resilience even when JWT tokens lack display names.
   - Lines 928–1091 (`updateKanbanCard`): Fixed legacy bug where `tutor_responsavel_id = tutorId` was unconditionally assigned. Preserves ownership invariant, updates card activity counters (`ultima_intervencao_em`, `qtd_intervencoes`), sets `data_resolucao = now()` on `revertido`, and writes event records (`mudanca_status`, `intervencao_manual`, `contato_enviado`) to `tutoria_atendimentos_historico`.
   - Lines 1094–1264 (`registrarIntervencao`): Validates inputs, correlates attendance cards, increments card metrics, and inserts audit events.
   - Lines 1276–1389 (`transferirTutor`): Validates card existence (404), validates target tutor existence (404), verifies tutor is active (400), blocks self-transfers (400), validates transition note length >= 5 (400), updates `tutor_responsavel_id`, and persists `passagem_bastao` audit record.
   - Lines 1392–1495 (`getTimelineAluno`): Sorts chronologically (`ORDER BY h."createdAt" ASC`), supports `atendimentoId` filtering, parses JSON metadata safely, and includes legacy synthetic fallback (`abertura`) for pre-existing cards with zero history.
   - Lines 1506–1519 (`getTutoresAtivos`): Retrieves active tutors from `"user"` where `"isActive" = true` ordered by `name ASC`.

6. `apps/backend/src/tutoria/tutoria.service.spec.ts` (750 lines)
   - Implements Universal Mock DB with recursive SQL template parsing (`extractSqlString`) and query routing.
   - 31 unit tests covering baseline functions and all 6 Milestone 2 functional groups.

### 1.2 Command Executions & Test Results

1. **TypeScript Typecheck**:
   - Command: `npx tsc --noEmit -p apps/backend/tsconfig.json`
   - Exit Code: `0` (Clean, zero compile errors).

2. **Unit Tests (Tutoria Module)**:
   - Command: `npm run test --prefix apps/backend -- tutoria.service.spec.ts`
   - Exit Code: `0`
   - Result: `Test Suites: 1 passed, 1 total; Tests: 31 passed, 31 total`.

3. **Backend Build**:
   - Command: `npm run build --prefix apps/backend`
   - Exit Code: `0` (Clean build output via `@nestjs/cli`).

4. **ESLint Verification**:
   - Command: `npx eslint -c apps/backend/eslint.config.mjs apps/backend/src/tutoria/dto/create-intervencao.dto.ts apps/backend/src/tutoria/dto/transferir-tutor.dto.ts apps/backend/src/tutoria/tutoria.controller.ts apps/backend/src/tutoria/tutoria.service.ts apps/backend/src/tutoria/tutoria.service.spec.ts`
   - Exit Code: `0` (0 errors, 0 warnings).

5. **Multi-Tutor Isolated E2E Test Suite**:
   - Command: `npm run test:e2e --prefix apps/backend -- tutoria-multitutor.e2e-spec.ts`
   - Exit Code: `0`
   - Result: `Test Suites: 1 passed, 1 total; Tests: 83 passed, 83 total` across Tiers 1–4.

6. **Full Backend Test Suite Regression Run**:
   - Command: `npm run test --prefix apps/backend`
   - Exit Code: `0`
   - Result: `Test Suites: 29 passed, 29 total; Tests: 137 passed, 137 total`.

---

## 2. Logic Chain

1. **Hybrid Multi-Tutor Ownership Invariant**:
   - *Requirement*: Collaborator tutors can update attendance cards (e.g. moving between columns, recording WhatsApp/phone outreach, updating pedagogical notes) without seizing primary case ownership (`tutor_responsavel_id`).
   - *Direct Inspection*: In `apps/backend/src/tutoria/tutoria.service.ts` (`updateKanbanCard`), lines 985–1037 define the exact fields included in the SQL `UPDATE` statement. `tutor_responsavel_id` is never appended.
   - *Adversarial Verification*: Tier 1 tests `TC-T1-F1-01` through `TC-T1-F1-03` and Tier 2 boundary test `TC-T2-F1-01` explicitly assert that attempts by collaborators to move cards or pass unexpected properties leave `card.tutor_responsavel_id` strictly unchanged.

2. **Audit Trail Immutability & Author Snapshots**:
   - *Requirement*: Audit events must record acting tutor identity (`autorId`, `autorNome`), event types, state transitions, contact channels, and timestamps.
   - *Direct Inspection*: Every mutative action (`updateKanbanCard`, `registrarIntervencao`, `transferirTutor`) executes an `INSERT INTO tutoria_atendimentos_historico`. The author's name is resolved via `resolveTutorInfo` with TTL caching, ensuring that JWT tokens omitting `name` do not write `null` or placeholder values.
   - *Adversarial Verification*: Tested under unit tests (Group 1, Group 6) and E2E Tier 1 (`TC-T1-F2-01` to `TC-T1-F2-05`). Even if a user record is deleted in the future (`ON DELETE SET NULL`), the denormalized `autor_nome` text column preserves historical accountability.

3. **Baton Pass Workflow Integrity**:
   - *Requirement*: Primary ownership transfer must only occur via explicit baton pass (`POST /api/tutoria/kanban/:id/transferir`) requiring target tutor validation and a minimum 5-character transition note.
   - *Direct Inspection*: `transferirTutor` in `tutoria.service.ts` verifies:
     - Card exists (404).
     - Target tutor exists (404).
     - Target tutor is active (400 if `isActive === false`).
     - Target tutor is not already the primary lead tutor (400 if self-transfer).
     - Transition note is at least 5 characters (400).
     - Persists `passagem_bastao` audit record capturing `tutor_responsavel_anterior_id` and `tutor_responsavel_novo_id`.
   - *Adversarial Verification*: Validated in unit test group 3 and E2E Tier 2 boundary cases `TC-T2-F5-01` through `TC-T2-F5-05`.

4. **Timeline Query & Legacy Fallback**:
   - *Requirement*: Consolidated timeline ordered chronologically with support for optional attendance filtering and graceful handling of legacy cards.
   - *Direct Inspection*: `getTimelineAluno` orders results with `ORDER BY h."createdAt" ASC`. When 0 audit events exist for an existing card, lines 1447–1492 execute a synthetic fallback creating an `abertura` event with `id: legacy-${c.id}` and tutor display name.
   - *Adversarial Verification*: Validated in unit test group 4 and E2E Tier 1 (`TC-T1-F6-01` to `TC-T1-F6-05`).

5. **Adversarial Stress Testing & Attack Vectors**:
   - *SQL Injection*: All dynamic variables are strictly parameterized via Drizzle `sql` tagged template literals. No raw string interpolation exists.
   - *Missing Author in JWT*: `resolveTutorInfo(undefined)` gracefully returns default `'Tutor Atuante'` without throwing errors or unhandled promise rejections.
   - *Database Outage during Cache Miss*: In `resolveTutorInfo`, internal database errors are caught and logged with `console.warn`, falling back to safe defaults without failing the parent request.
   - *JSON Metadata Parsing*: Stored strings are parsed inside a try-catch block; non-JSON or invalid strings are returned as raw text rather than crashing the response.

---

## 3. Caveats

1. **Frontend Integration Scope**: Frontend components (`TutoriaTimeline.tsx`, `TutoriaInterventionForm.tsx`, `BatonPassDialog.tsx`) and Server Actions (`apps/frontend/src/app/actions/tutoria.ts`) will be integrated and verified in Milestones 3 and 4.
2. **Database Migrations Scope**: Database schema creation and migration scripts were finalized in Milestone 1 (`apps/backend/src/db/migrate-tutoria-multitutor.ts`). Milestone 2 verified API layer conformance against this schema.
3. **Legacy Fallback Event Prefix**: The synthetic fallback event ID uses the format `legacy-${cardId}`. Frontend components should expect this string ID format when handling legacy discente cards.

---

## 4. Conclusion

The implementation for Milestone 2 meets all business requirements, interface contracts, and quality standards:
- **Verdict**: **APPROVE**
- **Integrity Assessment**: No hardcoded test fixtures, facade implementations, or bypasses were found. All tests and builds run genuinely with 100% pass rates.
- **Coverage**: 31 unit tests in `tutoria.service.spec.ts`, 83 E2E tests in `tutoria-multitutor.e2e-spec.ts`, and 137 full backend unit tests all pass cleanly.
- **Ready for Next Phase**: Milestone 3 (Frontend Timeline & Interventions UI) can proceed immediately.

---

## 5. Verification Method

To independently verify the Milestone 2 deliverables:

```powershell
# 1. Verify TypeScript types in backend
npx tsc --noEmit -p apps/backend/tsconfig.json

# 2. Verify ESLint compliance on modified files
npx eslint -c apps/backend/eslint.config.mjs apps/backend/src/tutoria/dto/create-intervencao.dto.ts apps/backend/src/tutoria/dto/transferir-tutor.dto.ts apps/backend/src/tutoria/tutoria.controller.ts apps/backend/src/tutoria/tutoria.service.ts apps/backend/src/tutoria/tutoria.service.spec.ts

# 3. Run Tutoria Service Unit Tests (31 tests)
npm run test --prefix apps/backend -- tutoria.service.spec.ts

# 4. Run Isolated Multi-Tutor E2E Suite (83 tests)
npm run test:e2e --prefix apps/backend -- tutoria-multitutor.e2e-spec.ts

# 5. Run Full Backend Unit Suite (137 tests)
npm run test --prefix apps/backend

# 6. Build Backend
npm run build --prefix apps/backend
```
