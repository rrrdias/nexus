# Handoff Report — Explorer Survey 3 (Build, Test & E2E Infra Focus)

**Mission**: Survey and investigate the monorepo build, test runners, migrations, and package scripts for `nexus-core`, establishing how tests run, how migrations execute, and how the Multi-Tutor E2E verification track must be architected.

---

## 1. Observation

### 1.1 Root Monorepo Configuration
- **File**: `package.json` (lines 1-19)
  ```json
  {
    "name": "nexus-core",
    "version": "1.0.0",
    "private": true,
    "packageManager": "npm@10.5.0",
    "workspaces": [
      "apps/*"
    ],
    "scripts": {
      "build": "turbo run build",
      "dev": "turbo run dev",
      "lint": "turbo run lint",
      "test": "npm run test --workspace=@nexus-core/backend",
      "test:e2e": "npm run test:e2e --workspace=@nexus-core/backend"
    },
    "devDependencies": {
      "turbo": "latest"
    }
  }
  ```
- **File**: `turbo.json` (lines 1-14)
  ```json
  {
    "$schema": "https://turbo.build/schema.json",
    "tasks": {
      "build": {
        "dependsOn": ["^build"],
        "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
      },
      "lint": {},
      "dev": {
        "cache": false,
        "persistent": true
      }
    }
  }
  ```
  *Key Observation*: The Turborepo pipeline defines tasks only for `build`, `lint`, and `dev`. It does NOT define a `test` or `test:e2e` pipeline; root `npm run test` delegates directly to `--workspace=@nexus-core/backend`.

---

### 1.2 Backend Scripts & Test Health
- **File**: `apps/backend/package.json` (lines 8-29)
  - `"build": "nest build"`
  - `"dev": "npm run start:dev"`
  - `"lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"`
  - `"test": "jest"`
  - `"test:watch": "jest --watch"`
  - `"test:cov": "jest --coverage"`
  - `"test:e2e": "jest --config ./test/jest-e2e.json --forceExit"`
  - Database scripts:
    - `"db:push": "drizzle-kit push"`
    - `"db:migrate-tutoria": "ts-node src/db/migrate-tutoria.ts"`
    - `"db:migrate-tutoria:prod": "node dist/db/migrate-tutoria.js"`
    - `"db:migrate-tutoria-dates": "ts-node src/db/migrate-tutoria-dates.ts"`
    - `"db:migrate-tutoria-dates:prod": "node dist/db/migrate-tutoria-dates.js"`
    - `"db:seed": "ts-node src/db/seed.ts"`
    - `"db:reset": "ts-node src/db/reset.ts"`

- **Tool Execution — Backend Build**:
  - Command: `npm --workspace=@nexus-core/backend run build` (`nest build`)
  - Result: **Exit code 0** (successful compilation into `apps/backend/dist`).

- **Tool Execution — Backend TypeScript Compilation Check**:
  - Command: `npm --workspace=@nexus-core/backend exec tsc -- --noEmit`
  - Result: **Exit code 0** (0 type errors).

- **Tool Execution — Backend Unit Tests**:
  - Command: `npm run test --workspace=@nexus-core/backend`
  - Result: **Exit code 0**.
  - Output summary:
    ```
    Test Suites: 29 passed, 29 total
    Tests:       109 passed, 109 total
    Snapshots:   0 total
    Time:        21.652 s
    ```
  - Includes `tutoria.service.spec.ts` (PASS) and `tutoria-sync.service.spec.ts` (PASS).

- **Tool Execution — Backend E2E Tests**:
  - Command: `npm run test:e2e` (`jest --config ./test/jest-e2e.json --forceExit`)
  - Result: **Exit code 1** (4 test suites failed, 12 tests failed, 44s elapsed).
  - Verbatim errors:
    1. `[Lyceum DB] Connection failed: Failed to connect to 172.29.44.90:1433 - Could not connect`
    2. `connect EACCES 127.0.0.1:6379` (Redis offline)
    3. `AggregateError: [Error: connect EACCES ::1:6379, Error: connect EACCES 127.0.0.1:6379]`
    4. `connect EACCES 127.0.0.1:58520` (Supertest ephemeral socket bind failure)
    5. `thrown: "Exceeded timeout of 30000 ms for a hook." at jobs-and-sync.e2e-spec.ts:94:3 (afterAll: await app.close())`

- **Tool Execution — Backend Lint**:
  - Command: `npm --workspace=@nexus-core/backend run lint`
  - Result: **Exit code 1** (`16 problems (1 error, 15 warnings)`).
  - Exact Error:
    ```
    C:\Users\ricardo.dias\develop\projetos\nexus-core\apps\backend\src\scheduling\guards\student-session.guard.spec.ts
      45:22  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
    ```

---

### 1.3 Frontend Scripts & Build Health
- **File**: `apps/frontend/package.json` (lines 5-11)
  ```json
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start --port 3002",
    "lint": "eslint",
    "test": "echo \"@nexus-core/frontend: unit tests verified\" && exit 0"
  }
  ```
  *Key Observation*: The frontend `test` script is an `echo` dummy. There is no Jest, Vitest, Cypress, or Playwright configured in `package.json`.

- **Tool Execution — Frontend TypeScript Compilation Check**:
  - Command: `npm --workspace=@nexus-core/frontend exec tsc -- --noEmit`
  - Result: **Exit code 0** (0 type errors).

- **Tool Execution — Frontend Utility Tests**:
  - Existing utility test files located at:
    - `apps/frontend/src/lib/activity-utils.test.ts`
    - `apps/frontend/src/lib/scheduling-utils.test.ts`
  - Command: `npx tsx apps/frontend/src/lib/activity-utils.test.ts`
  - Result: **Exit code 0**.
    ```
    Starting tests for activity-utils.ts...
    ✓ Test 1: 3-part Nome:Nota:Data parsed with grade and date
    ✓ Test 2: 3-part Nome:Status:Data parsed with status and date
    ✓ Test 3: Truncated 1-part fragment ignored without creating phantom activity
    ✓ Test 4: Date and grade validation edge cases passed
    ✓ Test 5: Authoritative phase reconciliation for G2610162 verified
    ✓ Test 6: Truncated 2-part/3-part/date tails in lista_notas safely handled
    ✓ Test 7: Evaluative activity filter and Daily phase classification verified
    All activity-utils tests passed successfully!
    ```

- **Tool Execution — Frontend Build**:
  - Command: `npm --workspace=@nexus-core/frontend run build` (`next build`)
  - Result: **Exit code 1**.
  - Verbatim error:
    ```
    > Build error occurred
    Error: Turbopack build failed with 2 errors:
    [next]/internal/font/google/dm_mono_27399902.module.css
    next/font: error:
    Failed to fetch `DM Mono` from Google Fonts.

    [next]/internal/font/google/plus_jakarta_sans_2874600c.module.css
    next/font: error:
    Failed to fetch `Plus Jakarta Sans` from Google Fonts.
    ```
  - Root cause: `apps/frontend/src/app/layout.tsx:2` imports Google Fonts (`Plus_Jakarta_Sans`, `DM_Mono`) using `next/font/google`. In offline/sandboxed build environments without outbound access to `fonts.googleapis.com`, Next.js compilation fails.

- **Tool Execution — Frontend Lint**:
  - Command: `npm --workspace=@nexus-core/frontend exec eslint -- --quiet`
  - Result: **Exit code 1** (6 errors):
    1. `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx:684:11 error 'text' is never reassigned. Use 'const' instead prefer-const`
    2. `apps/frontend/src/components/Topbar.tsx:34:7 error Avoid constructing JSX within try/catch react-hooks/error-boundaries` (and lines 35, 36, 39, 41).

---

### 1.4 Tutoria Module Architecture & DB Schema
- **File**: `apps/backend/src/db/schema.ts` (lines 615-805)
  - Tables present:
    1. `tutoriaLogsAtividades` (detailed activity logs per student and discipline).
    2. `tutoriaEngajamentoAluno` (consolidated student metrics: risk group, total minutes, clicks).
    3. `tutoriaPlanosAcao` (AI/pedagogical intervention plans).
    4. `tutoriaAtendimentosKanban` (Kanban cards).
  - *Critical Absence*: There is currently NO table for attendance history / audit trail (`tutoria_atendimentos_historico`).

- **File**: `apps/backend/src/tutoria/tutoria.service.ts` (lines 761-770)
  ```typescript
  if (tutorId) {
    try {
      const u = await this.db.execute(sql`SELECT id FROM "user" WHERE id = ${tutorId} LIMIT 1;`);
      if (u.length > 0) {
        updates.push(sql`tutor_responsavel_id = ${tutorId}`);
      }
    } catch {
      // Ignora se id de tutor inválido
    }
  }
  ```
  *Critical Defect*: In `updateKanbanCard`, whenever *any* tutor performs an action (e.g. moves a card, adds a note, or logs a contact), `tutor_responsavel_id` is unconditionally updated to the calling `tutorId`! This violates the Hybrid Multi-Tutor model requirement where a card preserves its primary tutor (`tutorResponsavelId`), while recording the acting user as an intervenor in the timeline.

- **File**: `apps/backend/src/tutoria/tutoria.module.ts` (lines 8-14)
  ```typescript
  @Module({
    imports: [DbModule, CacheModule],
    controllers: [TutoriaController],
    providers: [TutoriaService, TutoriaSyncService],
    exports: [TutoriaService, TutoriaSyncService],
  })
  export class TutoriaModule {}
  ```
  *Key Observation*: `TutoriaModule` is cleanly isolated! It depends ONLY on `DbModule` and `CacheModule`. It does NOT depend on `BullModule` (Redis) or `AcademicModule` (Lyceum SQL Server).

---

### 1.5 Database Migration Strategy
- Historical progression:
  1. Drizzle-kit SQL migrations were generated in `apps/backend/drizzle/` until June 2026 (`0000_perfect_human_torch.sql` through `0003_quick_goblin_queen.sql`).
  2. For the Tutoria module (October–November 2026), migrations switched to standalone idempotent TypeScript scripts:
     - `src/db/migrate-tutoria.ts`
     - `src/db/migrate-tutoria-dates.ts`
  3. These scripts execute raw SQL via `db.execute(sql\`...\`)` using `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS`.
  4. In addition, `TutoriaService.onModuleInit()` calls `this.ensureKanbanTable()` (lines 36-78) to guarantee tables and columns exist automatically on application boot.

---

## 2. Logic Chain

1. **Why `test:e2e` fails**:
   - `apps/backend/test/*.e2e-spec.ts` imports the full `AppModule`.
   - `AppModule` imports `BullModule.forRootAsync(...)` and `AcademicModule`.
   - On `app.init()`, `AcademicService.onModuleInit()` attempts a socket connection to Lyceum SQL Server (`172.29.44.90:1433`) and BullMQ workers attempt connections to `127.0.0.1:6379`.
   - Because neither service is running locally, connections fail with `EACCES` and `afterAll(await app.close())` hangs, exceeding the 30-second timeout.
   - *Therefore*: End-to-end tests for `TutoriaModule` should NOT instantiate `AppModule`. Instead, they must instantiate `TutoriaModule` in isolation (with `overrideProvider(DB_CONNECTION)` and `overrideProvider(CacheService)`), enabling deterministic, lightning-fast integration/E2E test runs without requiring live Redis or Lyceum instances.

2. **Why the Monorepo Build and Lint fail the Acceptance Criteria**:
   - Acceptance criteria require: `Build do monorepo (npm run build ou equivalente no Turborepo) executa com sucesso no backend e frontend sem erros de tipagem TypeScript ou lint.`
   - Both backend and frontend already compile cleanly with `tsc --noEmit` (0 errors).
   - Backend build (`nest build`) passes with exit code 0.
   - However:
     - Frontend build fails if network access to Google Fonts is blocked.
     - Backend lint fails due to 1 error in `student-session.guard.spec.ts:45:22` (`@typescript-eslint/no-require-imports`).
     - Frontend lint fails due to 1 error in `TutoriaDashboard.tsx:684:11` (`prefer-const`) and 5 errors in `Topbar.tsx` (`react-hooks/error-boundaries`).
   - *Therefore*: Fixing these specific lint violations and providing an offline font fallback or stub will achieve 100% build & lint pass rate for the entire monorepo.

3. **Why the Database Migration must follow the TypeScript idempotent script pattern**:
   - `schema.ts` is the single source of truth for Drizzle ORM types across backend controllers and services.
   - However, production schema migrations in `nexus-core` are executed via `ts-node src/db/migrate-tutoria.ts` (npm script `"db:migrate-tutoria"`).
   - *Therefore*: To implement R2 (audit trail table `tutoria_atendimentos_historico`), we must:
     a) Define the table in `apps/backend/src/db/schema.ts`.
     b) Create `apps/backend/src/db/migrate-tutoria-multitutor.ts` using idempotent DDL (`CREATE TABLE IF NOT EXISTS tutoria_atendimentos_historico`, foreign keys, and indexes).
     c) Add `"db:migrate-tutoria-multitutor": "ts-node src/db/migrate-tutoria-multitutor.ts"` to `apps/backend/package.json`.
     d) Add `ensureTimelineTable()` inside `TutoriaService.onModuleInit()` so test environments and fresh boots auto-provision the table.

4. **Why `TutoriaService.updateKanbanCard` must be refactored for Multi-Tutor support**:
   - Currently, updating a card (e.g. changing column or adding observation) sets `tutor_responsavel_id = tutorId` unconditionally.
   - In the hybrid multi-tutor model (R1), any tutor can move a card or add a note, but the `tutor_responsavel_id` (primary owner) must remain unchanged unless an explicit baton pass (`transferir_bastao` action) is submitted with an explanatory note.
   - Any modification must insert a corresponding event record into `tutoria_atendimentos_historico` capturing `autor_id`, `autor_nome`, `tipo_evento`, `estado_anterior`, `estado_novo`, and `observacoes`.

---

## 3. Caveats

1. **Redis & Lyceum External Connectivity**:
   - The failure of the existing 4 backend e2e test files (`app.e2e-spec.ts`, `auth-and-rbac.e2e-spec.ts`, `jobs-and-sync.e2e-spec.ts`, `observability.e2e-spec.ts`) is caused by environment configuration (lack of local Redis service and unroutable private IP `172.29.44.90`). This is a known external infrastructure dependency, not a bug in the application logic.
2. **Next.js Google Fonts at Build Time**:
   - `next build` requires network access to `fonts.googleapis.com` by default. In air-gapped or restricted CI runners, fonts can be downloaded locally or stubbed using standard CSS font declarations.
3. **Frontend Testing Ecosystem**:
   - The frontend currently has no browser-level test runner (Playwright/Cypress/Jest). Frontend verification is currently performed via TypeScript typechecks, ESLint, and Node/tsx unit test scripts for utilities.

---

## 4. Conclusion & Design Recommendations

### 4.1 Monorepo Build & Script Architecture
1. **Workspaces**: Maintained as `apps/*` (`@nexus-core/backend` and `@nexus-core/frontend`).
2. **Turborepo Pipeline**:
   - Keep `build` and `lint` in `turbo.json`.
   - Add a `typecheck` task to `turbo.json` (`"typecheck": { "dependsOn": ["^build"] }`) or continue using workspace scripts `npm run typecheck`.

### 4.2 Database Schema & Migration Specification (R2)
1. **Schema Addition in `apps/backend/src/db/schema.ts`**:
   ```typescript
   export const tutoriaAtendimentosHistorico = pgTable(
     'tutoria_atendimentos_historico',
     {
       id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
       atendimentoId: text('atendimento_id').references(() => tutoriaAtendimentosKanban.id, {
         onDelete: 'cascade',
       }).notNull(),
       matricula: text('matricula').notNull(),
       periodo: text('periodo').notNull(),
       sourceInstitution: text('sourceInstitution').default('ead').notNull(),
       tipoEvento: text('tipo_evento').notNull(), // 'abertura', 'mudanca_status', 'contato_enviado', 'intervencao_manual', 'passagem_bastao', 'finalizacao', 'reabertura', 'nota_pedagogica'
       autorId: text('autor_id').references(() => users.id, { onDelete: 'set null' }),
       autorNome: text('autor_nome'),
       tutorResponsavelAnteriorId: text('tutor_responsavel_anterior_id').references(() => users.id, { onDelete: 'set null' }),
       tutorResponsavelNovoId: text('tutor_responsavel_novo_id').references(() => users.id, { onDelete: 'set null' }),
       estadoAnterior: text('estado_anterior'),
       estadoNovo: text('estado_novo'),
       canalContato: text('canal_contato'),
       observacoes: text('observacoes'),
       metadata: text('metadata'),
       createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
     },
     (t) => [
       index('idx_tutoria_hist_atendimento').on(t.atendimentoId),
       index('idx_tutoria_hist_matricula').on(t.matricula),
       index('idx_tutoria_hist_created_at').on(t.createdAt),
       index('idx_tutoria_hist_tipo').on(t.tipoEvento),
     ]
   );
   ```

2. **Migration Script**:
   - Create `apps/backend/src/db/migrate-tutoria-multitutor.ts` running idempotent SQL DDL.
   - Register script in `apps/backend/package.json`:
     `"db:migrate-tutoria-multitutor": "ts-node src/db/migrate-tutoria-multitutor.ts"`
   - Add `ensureTimelineTable()` inside `TutoriaService.onModuleInit()`.

### 4.3 Backend Service & API Specification (R1 & R3)
1. **Refactor `updateKanbanCard`**:
   - Distinguish between acting user (`req.user.id`) and card primary owner (`tutorResponsavelId`).
   - Do NOT overwrite `tutor_responsavel_id` unless the payload explicitly specifies a baton transfer.
   - Automatically insert a row into `tutoria_atendimentos_historico` when status changes, contact is logged, or note is added.
2. **New Endpoints**:
   - `POST /api/tutoria/kanban/:id/intervencao`: Add manual intervention or pedagogical note.
   - `POST /api/tutoria/kanban/:id/transferir-tutor`: Transfer lead tutor (`tutorResponsavelId`) with transition note.
   - `GET /api/tutoria/aluno/:matricula/timeline`: Fetch consolidated chronological history for the student across cards.
   - `GET /api/tutoria/kanban/:id/timeline`: Fetch timeline specific to the attendance card.

### 4.4 Recommendations for the E2E Testing Track
1. **Dedicated Module Test Suite (`apps/backend/test/tutoria.e2e-spec.ts`)**:
   - Use `Test.createTestingModule({ imports: [TutoriaModule] })` (or minimal test module).
   - Override `DB_CONNECTION` with a stateful in-memory mock or chained query tracker.
   - Override `CacheService` with a mock.
   - Test cases to cover:
     - TC-01: Kanban card creation with primary tutor assignment (`tutorResponsavelId`).
     - TC-02: Intervenor tutor moves card column -> verify card `status_kanban` updates, `tutor_responsavel_id` remains unchanged, and `tutoria_atendimentos_historico` records event `mudanca_status` with intervenor ID.
     - TC-03: Baton passing -> POST transfer endpoint -> verify `tutor_responsavel_id` changes to Tutor B, and history records `passagem_bastao` with transition note.
     - TC-04: Timeline retrieval -> GET `/api/tutoria/aluno/:matricula/timeline` -> verify events return in reverse chronological order with full metadata.
2. **Frontend Action Test Suite**:
   - Add `apps/frontend/src/lib/tutoria-actions.test.ts` runnable via `tsx` to validate API payload generation, timeline grouping, and date formatting.
3. **Clean Monorepo Build & Lint Target**:
   - Fix line 684 in `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx` (`prefer-const`).
   - Fix `apps/backend/src/scheduling/guards/student-session.guard.spec.ts:45` (`no-require-imports`).
   - Fix or wrap JSX in `apps/frontend/src/components/Topbar.tsx`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Backend Unit Tests**:
   ```powershell
   npm run test --workspace=@nexus-core/backend
   ```
   *Expected*: 29 test suites passed, 109 tests passed.

2. **Verify Monorepo TypeScript Typing**:
   ```powershell
   npm --workspace=@nexus-core/backend exec tsc -- --noEmit
   npm --workspace=@nexus-core/frontend exec tsc -- --noEmit
   ```
   *Expected*: Both commands exit with code 0.

3. **Verify Backend Build**:
   ```powershell
   npm --workspace=@nexus-core/backend run build
   ```
   *Expected*: NestJS builds successfully to `apps/backend/dist`.

4. **Verify Frontend Standalone Utility Tests**:
   ```powershell
   npx tsx apps/frontend/src/lib/activity-utils.test.ts
   npx tsx apps/frontend/src/lib/scheduling-utils.test.ts
   ```
   *Expected*: Both test files execute and pass all assertions.

5. **Verify Lint Diagnostics**:
   ```powershell
   npm --workspace=@nexus-core/backend run lint
   npm --workspace=@nexus-core/frontend exec eslint -- --quiet
   ```
   *Expected*: Backend reports 1 error in `student-session.guard.spec.ts:45`; Frontend reports 1 error in `TutoriaDashboard.tsx:684` and 5 in `Topbar.tsx`.

6. **Invalidation Conditions**:
   - If `AppModule` is modified to conditionally mock Redis/Lyceum in test mode, `npm run test:e2e` could pass without module isolation.
   - If Google Fonts are downloaded locally or replaced with system fallbacks, `next build` will succeed in offline sandboxes.
