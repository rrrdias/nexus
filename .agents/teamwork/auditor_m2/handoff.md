# Forensic Audit Report: Milestone 2 (Backend Tutoria APIs & Hybrid Ownership)

**Auditor**: Forensic Auditor (`auditor_m2`)  
**Target Milestone**: Milestone 2 — Backend Tutoria APIs & Hybrid Ownership  
**Recipient**: Parent Orchestrator (`7eeca256-7483-44cc-8dd1-1e2137a194ab`)  
**Date**: 2026-11-10T21:37:00Z  
**Integrity Mode**: Development (from `ORIGINAL_REQUEST.md`)  
**Final Verdict**: **CLEAN**

---

## 1. Observation

### 1.1 Forensic Codebase Analysis

The following files were inspected in depth:
- `apps/backend/src/tutoria/dto/create-intervencao.dto.ts`
- `apps/backend/src/tutoria/dto/transferir-tutor.dto.ts`
- `apps/backend/src/tutoria/dto/update-kanban-card.dto.ts`
- `apps/backend/src/tutoria/tutoria.controller.ts`
- `apps/backend/src/tutoria/tutoria.service.ts`
- `apps/backend/src/tutoria/tutoria.service.spec.ts`

#### A. Cheating, Hardcoding & Facade Checks
1. **Search for Hardcoded Identifiers**:
   - Command: `git grep -E -i "(card-101|20261001|tutor-lead-1|tutor-collab-2|tutor-new-3)" apps/backend/src/tutoria`
   - Result:
     - Found 0 matches in `tutoria.service.ts`.
     - Found 0 matches in `tutoria.controller.ts`.
     - Found 0 matches in `apps/backend/src/tutoria/dto/*`.
     - All matches occurred strictly within the test harness (`tutoria.service.spec.ts`) as fixture seed data.
2. **Facade & Dummy Detection**:
   - `updateKanbanCard` (`tutoria.service.ts:928-1091`): Executes genuine parameterized SQL update queries (`UPDATE tutoria_atendimentos_kanban SET ... WHERE id = ${id}`) and inserts corresponding audit records into `tutoria_atendimentos_historico` on status changes (`mudanca_status`), notes updates (`intervencao_manual`), and contact channel usage (`contato_enviado`).
   - `registrarIntervencao` (`tutoria.service.ts:1094-1264`): Validates inputs, looks up existing attendance cards, updates card metrics (`ultima_intervencao_em = now()`, `qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1`), and inserts into `tutoria_atendimentos_historico`.
   - `transferirTutor` (`tutoria.service.ts:1276-1389`): Queries database for card existence and active status of the target tutor, blocks self-transfers, validates minimum transition note length, executes `UPDATE tutoria_atendimentos_kanban SET tutor_responsavel_id = ${novoTutorId}`, and inserts `passagem_bastao` audit record.
   - `getTimelineAluno` (`tutoria.service.ts:1392-1495`): Queries `tutoria_atendimentos_historico` with parameterized SQL filters, parses JSON metadata safely, and provides an authentic fallback to `tutoria_atendimentos_kanban` for legacy cards without history.
   - `getTutoresAtivos` (`tutoria.service.ts:1506-1514`): Executes genuine SQL query `SELECT id, name, email FROM "user" WHERE "isActive" = true ORDER BY name ASC;`.
3. **DTO Validation Decorators**:
   - Verified that `class-validator` and `class-transformer` decorators are used authentically: `@IsNotEmpty`, `@IsOptional`, `@IsString`, `@IsIn`, `@MinLength(5)`, `@Transform`.

#### B. Anti-Circumvention & Bug Fix Verification
- In legacy code, every call to `updateKanbanCard` overwrote `tutor_responsavel_id = ${tutorId}`.
- Inspection of `tutoria.service.ts:985-1037` confirms that `tutor_responsavel_id` is NEVER mutated during `updateKanbanCard`. Lead tutor ownership is strictly preserved.
- Transfer of ownership is isolated exclusively to `transferirTutor`, requiring valid target tutor and pedagogical transition note.
- Denormalized author snapshot (`autorNome`, `autorId`) is captured via `resolveTutorInfo` with a 60-second in-memory TTL cache, querying the `"user"` table dynamically to resolve tutor names even when JWT payloads omit them.

### 1.2 Independent Behavioral Verification

1. **TypeScript Typecheck**:
   - Command: `npx tsc --noEmit -p apps/backend/tsconfig.json`
   - Output: Exit code 0 (clean, 0 type errors).

2. **Unit Tests (Milestone 2 Suite)**:
   - Command: `npm run test --prefix apps/backend -- tutoria.service.spec.ts`
   - Output:
     ```
     PASS src/tutoria/tutoria.service.spec.ts
       TutoriaService
         √ should be defined (13 ms)
         √ should return dashboard summary (3 ms)
         √ should trigger manual sync via TutoriaSyncService (2 ms)
         √ should run onModuleInit and ensure kanban and timeline tables without throwing (2 ms)
         √ should gracefully handle database errors in ensureTimelineTable without crashing (37 ms)
         updateKanbanCard (Hybrid Ownership & History)
           √ should preserve tutorResponsavelId when a collaborator moves card (4 ms)
           √ should automatically record audit event on status change with author snapshot (2 ms)
           √ should increment qtdIntervencoes and update ultimaIntervencaoEm when meaningful change happens (7 ms)
           √ should update canalContatoUtilizado and ultimoContatoEm when contact channel provided (2 ms)
           √ should throw NotFoundException when card does not exist (19 ms)
           √ should throw BadRequestException when status is invalid (1 ms)
         createIntervencao / registrarIntervencao
           √ should record a manual intervention and link to card (2 ms)
           √ should record a contact attempt with channel via alias createIntervencao (2 ms)
           √ should throw BadRequestException when matricula is empty (1 ms)
           √ should throw BadRequestException when observacoes is empty (1 ms)
           √ should throw BadRequestException when tipoEvento is invalid (2 ms)
         transferirTutor (Passagem de Bastão)
           √ should transfer card ownership to new tutor and create passagem_bastao event (2 ms)
           √ should throw NotFoundException when card does not exist for transfer (2 ms)
           √ should throw NotFoundException when target tutor does not exist (1 ms)
           √ should throw BadRequestException when target tutor is inactive (1 ms)
           √ should throw BadRequestException when target tutor is already current owner (2 ms)
           √ should throw BadRequestException when transition note is too short (< 5 chars) (1 ms)
         getTimelineAluno / getStudentTimeline
           √ should return chronological timeline events (2 ms)
           √ should filter timeline events by atendimentoId when query parameter is provided (1 ms)
           √ should generate fallback abertura event when 0 history events exist for card (1 ms)
           √ should return empty array when matricula has no card and no history (2 ms)
           √ should throw BadRequestException when matricula is empty (1 ms)
         getTutoresAtivos / getActiveTutors
           √ should return active tutors list excluding inactive tutors (3 ms)
           √ should work identically through getActiveTutors alias (1 ms)
         Author Name Resolution & Cache (resolveTutorInfo)
           √ should return cached tutor info on repeated invocations without querying database (2 ms)
           √ should return default fallback name when user id is null or undefined (1 ms)

     Test Suites: 1 passed, 1 total
     Tests:       31 passed, 31 total
     Snapshots:   0 total
     Time:        2.034 s
     ```

3. **Backend NestJS Build**:
   - Command: `npm run build --prefix apps/backend`
   - Output: Exit code 0 (clean build via `nest build`).

4. **ESLint Verification**:
   - Command: `npx eslint -c apps/backend/eslint.config.mjs apps/backend/src/tutoria/dto/create-intervencao.dto.ts apps/backend/src/tutoria/dto/transferir-tutor.dto.ts apps/backend/src/tutoria/dto/update-kanban-card.dto.ts apps/backend/src/tutoria/tutoria.controller.ts apps/backend/src/tutoria/tutoria.service.ts apps/backend/src/tutoria/tutoria.service.spec.ts`
   - Output: Exit code 0 (0 errors, 0 warnings).

5. **Multi-Tutor Isolated E2E Test Suite**:
   - Command: `npm run test:e2e --prefix apps/backend -- tutoria-multitutor.e2e-spec.ts`
   - Output: Exit code 0 (83/83 passed across Tiers 1-4).

6. **Full Backend Test Suite**:
   - Command: `npm run test --prefix apps/backend`
   - Output: Exit code 0 (29/29 test suites passed, 137/137 tests passed).

---

## 2. Logic Chain

1. **Absence of Cheating / Hardcoding**:
   - Grep analysis revealed no hardcoded test identifiers or fixed responses in application source code (`apps/backend/src/tutoria/`).
   - Mock DB implementation in `tutoria.service.spec.ts` parses SQL queries dynamically and inspects SQL clauses (e.g. verifying that `tutor_responsavel_id` is NOT part of update statements).
   - Test assertions are non-tautological and test real behavioral branches (404, 400, cache hits, audit insertions).

2. **Genuineness of Business Invariants**:
   - The primary ownership preservation invariant was empirically tested: when collaborators perform card actions (move columns, edit notes, log outreach), `tutor_responsavel_id` remains unchanged.
   - Ownership transfers only occur via `transferirTutor`, which strictly verifies target existence, target active status, prevents self-transfers, and enforces explanatory notes.
   - Audit trail persistence in `tutoria_atendimentos_historico` adheres to the PostgreSQL table schema defined in `apps/backend/src/db/schema.ts`.

3. **Robustness Under Adversarial Edge Cases**:
   - Injected payload properties cannot overwrite `tutor_responsavel_id` via `updateKanbanCard` because the update builder explicitly restricts mutable fields.
   - Unauthenticated or unauthorized callers are blocked by `@RequireModule('tutoria')` and JWT guards.
   - Missing or legacy data is handled gracefully (fallback opening event for legacy cards, author fallback to 'Tutor Atuante' when user records lack names).

---

## 3. Caveats

- **Frontend Integration**: Milestone 2 encompasses backend endpoints and service logic. Client-side consumption of these APIs (Server Actions, `TutoriaTimeline.tsx`, and `TutoriaKanbanClient.tsx`) is scheduled for Milestones 3 and 4.
- **Database Schema Provisioning**: The Drizzle schema and migration hook were provisioned in Milestone 1; Milestone 2 verifies that service queries and mutations accurately conform to this schema.

---

## 4. Conclusion

The Milestone 2 work product is completely free of hardcoding, dummy mocks, facades, and integrity violations. All business rules, DTO validations, audit logging mechanics, and error handling branches are implemented authentically and independently verified.

**VERDICT: CLEAN**

---

## 5. Verification Method

To reproduce the forensic verification results independently:

```powershell
# 1. Verify TypeScript type safety
npx tsc --noEmit -p apps/backend/tsconfig.json

# 2. Run Milestone 2 unit tests
npm run test --prefix apps/backend -- tutoria.service.spec.ts

# 3. Verify backend build
npm run build --prefix apps/backend

# 4. Verify ESLint clean status
npx eslint -c apps/backend/eslint.config.mjs apps/backend/src/tutoria/dto/create-intervencao.dto.ts apps/backend/src/tutoria/dto/transferir-tutor.dto.ts apps/backend/src/tutoria/dto/update-kanban-card.dto.ts apps/backend/src/tutoria/tutoria.controller.ts apps/backend/src/tutoria/tutoria.service.ts apps/backend/src/tutoria/tutoria.service.spec.ts

# 5. Run Multi-Tutor E2E suite
npm run test:e2e --prefix apps/backend -- tutoria-multitutor.e2e-spec.ts

# 6. Run full backend unit suite
npm run test --prefix apps/backend
```
