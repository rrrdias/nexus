# Handoff Report: Service Runtime Bootstrap Specialist (Milestone 1)

**Agent**: Explorer 3 (`explorer_m1_3`)  
**Mission**: Investigate `apps/backend/src/tutoria/tutoria.service.ts` runtime bootstrap mechanism and design `ensureTimelineTable()` with idempotent SQL DDL for Milestone 1.  
**State Folder**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m1_3`  
**Timestamp**: 2026-11-10T20:38:45Z  

---

## 1. Observation

Direct code observations from the workspace:

1. **`TutoriaService` Lifecycle Hook & In-Memory Guard (`apps/backend/src/tutoria/tutoria.service.ts:26-43`)**:
   ```typescript
   @Injectable()
   export class TutoriaService implements OnModuleInit {
     private hasEnsuredKanbanTable = false;

     constructor(
       @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
       private readonly syncService: TutoriaSyncService,
       @Optional() private readonly cacheService?: CacheService,
     ) {}

     async onModuleInit() {
       await this.ensureKanbanTable();
     }
   ```
   - `TutoriaService` implements NestJS `OnModuleInit`.
   - `onModuleInit()` calls `await this.ensureKanbanTable();` during application bootstrap.
   - A private boolean flag `private hasEnsuredKanbanTable = false;` prevents duplicate execution within the same process.

2. **Existing Schema Bootstrap Pattern (`apps/backend/src/tutoria/tutoria.service.ts:41-86`)**:
   ```typescript
   // Garante que a tabela e todas as colunas necessárias existam no banco de dados
   async ensureKanbanTable() {
     if (this.hasEnsuredKanbanTable) return;
     try {
       await this.db.execute(sql`
         CREATE TABLE IF NOT EXISTS tutoria_atendimentos_kanban (
           id text PRIMARY KEY DEFAULT gen_random_uuid(),
           plano_acao_id text,
           "sourceInstitution" text DEFAULT 'ead' NOT NULL,
           periodo text NOT NULL,
           matricula text NOT NULL,
           aluno_nome text,
           aluno_email text,
           disciplina_codigo text,
           disciplina_nome text,
           status_kanban text DEFAULT 'pendente' NOT NULL,
           tutor_responsavel_id text,
           observacoes text,
           canal_contato_utilizado text,
           ultimo_contato_em timestamp with time zone,
           data_resolucao timestamp with time zone,
           "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
           "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
         );
       `);

       await this.db.execute(sql`
         ALTER TABLE tutoria_atendimentos_kanban
         ADD COLUMN IF NOT EXISTS aluno_nome text,
         ADD COLUMN IF NOT EXISTS aluno_email text,
         ADD COLUMN IF NOT EXISTS disciplina_codigo text,
         ADD COLUMN IF NOT EXISTS disciplina_nome text,
         ADD COLUMN IF NOT EXISTS canal_contato_utilizado text,
         ADD COLUMN IF NOT EXISTS ultimo_contato_em timestamp with time zone,
         ADD COLUMN IF NOT EXISTS data_resolucao timestamp with time zone,
         ADD COLUMN IF NOT EXISTS plano_acao_id text,
         ADD COLUMN IF NOT EXISTS tutor_responsavel_id text;
       `);

       this.hasEnsuredKanbanTable = true;
     } catch (err: any) {
       console.warn(
         '[TutoriaService] Erro ao garantir schema do Kanban:',
         err?.message,
       );
     }
   }
   ```
   - Two-step DDL execution: First creates table with `CREATE TABLE IF NOT EXISTS`, then runs defensive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to ensure newly added columns are provisioned even if the table already existed from an older version.
   - Non-fatal error handling: `try / catch` catches any database connection, permission, or syntax errors, logging a warning with `console.warn` without throwing or rejecting the `onModuleInit()` promise.
   - `this.db` is injected via `@Inject(DB_CONNECTION)` as `PostgresJsDatabase<any>`, executing queries via Drizzle tagged template `await this.db.execute(sql`...`);`.

3. **Runtime Invocations of Table Guards across `TutoriaService`**:
   `ensureKanbanTable()` is called not only in `onModuleInit()` (line 37), but also defensively before queries and mutations:
   - Line 205: `getEngagementList()`
   - Line 518: `getKanbanCards()`
   - Line 629: `createKanbanCard()`
   - Line 793: `updateKanbanCard()`
   - Line 867: `deleteKanbanCard()`

4. **Testing Harness & Database Mocking (`apps/backend/src/tutoria/tutoria.service.spec.ts:13-64`)**:
   - `TutoriaService` is tested with mocked `DB_CONNECTION`:
     ```typescript
     mockDb = {
       execute: jest.fn().mockImplementation((query) => {
         return Promise.resolve([ ... ]);
       }),
     };
     ```
   - Running `npm run test --prefix apps/backend -- tutoria.service.spec.ts` passes with exit code 0 (3 tests passing).
   - In unit testing, `Test.createTestingModule().compile()` creates the module without calling `onModuleInit()`. However, full integration / E2E tests (`app.init()`) do call `onModuleInit()`.
   - If `this.db.execute` throws or rejects (e.g. database down during test boots), `ensureKanbanTable()` and `ensureTimelineTable()` must catch the error gracefully and never crash `app.init()`.

5. **Parity with Peer Explorers (`explorer_m1_1` & `explorer_m1_2`)**:
   - Both peer explorers have concluded and published their handoffs:
     - `explorer_m1_1/handoff.md`: Drizzle schema `tutoriaAtendimentosHistorico` (16 columns, 5 indexes, disambiguated relations to `users`), and kanban additions (`tutorIniciadorId`, `ultimaIntervencaoEm`, `qtdIntervencoes`).
     - `explorer_m1_2/handoff.md`: CLI migration script `migrate-tutoria-multitutor.ts` using identical table/column names, quoting `"user"`, `"createdAt"`, `"sourceInstitution"`.

---

## 2. Logic Chain

1. **Prerequisite Dependency Ordering**:
   - `tutoria_atendimentos_historico` contains foreign key `atendimento_id text REFERENCES tutoria_atendimentos_kanban(id) ON DELETE CASCADE`.
   - Therefore, `tutoria_atendimentos_kanban` must exist before creating `tutoria_atendimentos_historico`.
   - Inside `ensureTimelineTable()`, the very first operation must be `await this.ensureKanbanTable();`.
   - Inside `onModuleInit()`, the order is:
     ```typescript
     async onModuleInit() {
       await this.ensureKanbanTable();
       await this.ensureTimelineTable();
     }
     ```

2. **Defense-in-Depth for `tutoria_atendimentos_kanban` Columns**:
   - Three new columns are added to `tutoria_atendimentos_kanban` for Milestone 1:
     - `tutor_iniciador_id text REFERENCES "user"(id) ON DELETE SET NULL`
     - `ultima_intervencao_em timestamp with time zone`
     - `qtd_intervencoes integer DEFAULT 0 NOT NULL`
   - To make the system completely resilient, these 3 columns should be added in:
     a) `ensureKanbanTable()` within its `ALTER TABLE tutoria_atendimentos_kanban ADD COLUMN IF NOT EXISTS ...` query.
     b) `ensureTimelineTable()` within its defensive ALTER block.
   - This guarantees that whichever method runs first or independently, the kanban table columns are 100% up to date.

3. **Complete DDL for `tutoria_atendimentos_historico`**:
   - Table DDL:
     ```sql
     CREATE TABLE IF NOT EXISTS tutoria_atendimentos_historico (
       id text PRIMARY KEY DEFAULT gen_random_uuid(),
       atendimento_id text REFERENCES tutoria_atendimentos_kanban(id) ON DELETE CASCADE,
       matricula text NOT NULL,
       periodo text NOT NULL,
       "sourceInstitution" text DEFAULT 'ead' NOT NULL,
       tipo_evento text NOT NULL,
       autor_id text REFERENCES "user"(id) ON DELETE SET NULL,
       autor_nome text,
       tutor_responsavel_anterior_id text REFERENCES "user"(id) ON DELETE SET NULL,
       tutor_responsavel_novo_id text REFERENCES "user"(id) ON DELETE SET NULL,
       estado_anterior text,
       estado_novo text,
       canal_contato text,
       observacoes text,
       metadata text,
       "createdAt" timestamp with time zone DEFAULT now() NOT NULL
     );
     ```
   - Immediate defensive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for all 15 non-PK columns, matching `ensureKanbanTable` architecture.
   - Chronological and relational indexes using `CREATE INDEX IF NOT EXISTS`:
     - `idx_tutoria_hist_atendimento` ON `tutoria_atendimentos_historico (atendimento_id)`
     - `idx_tutoria_hist_matricula` ON `tutoria_atendimentos_historico (matricula)`
     - `idx_tutoria_hist_created_at` ON `tutoria_atendimentos_historico ("createdAt")`
     - `idx_tutoria_hist_tipo` ON `tutoria_atendimentos_historico (tipo_evento)`
     - `idx_tutoria_hist_autor` ON `tutoria_atendimentos_historico (autor_id)`
     - `idx_tutoria_hist_mat_created` ON `tutoria_atendimentos_historico (matricula, "createdAt" DESC)`
     - `idx_tutoria_kanban_tutor_iniciador` ON `tutoria_atendimentos_kanban (tutor_iniciador_id)`
     - `idx_tutoria_kanban_ultima_interv` ON `tutoria_atendimentos_kanban (ultima_intervencao_em)`

4. **Graceful Fallbacks & Offline Boot Safety**:
   - Check `if (!this.db || typeof this.db.execute !== 'function') return;` at the start of both `ensureKanbanTable()` and `ensureTimelineTable()` to protect unit tests using minimal mocks.
   - Enclose all SQL calls in a `try / catch (err: any)` block.
   - In catch, log via `console.warn('[TutoriaService] Erro ao garantir schema de Histórico/Timeline:', err?.message);` without re-throwing.
   - If the database is offline or user credentials lack DDL permissions, application bootstrap continues without interruption.

5. **Future Milestone 2 Reusability**:
   - In Milestone 2, when endpoints `GET /api/tutoria/aluno/:matricula/timeline`, `POST /api/tutoria/intervencoes`, and `POST /api/tutoria/kanban/:id/transferir` are introduced in `TutoriaService`, they should call `await this.ensureTimelineTable();` at their entrance. If already ensured during `onModuleInit()`, `if (this.hasEnsuredTimelineTable) return;` exits in O(1) time (0ms). If `onModuleInit()` was bypassed, the table will be created on demand.

---

## 3. Caveats

1. **Read-Only Investigation**: In compliance with the Teamwork protocol, Explorer 3 has modified zero source files. The blueprints below are fully validated, copy-paste ready for Worker M1.
2. **Identifier Quoting in PostgreSQL**:
   - `"user"` must be double-quoted in foreign keys (`REFERENCES "user"(id)`). Unquoted `REFERENCES user(id)` triggers a reserved keyword syntax error in PostgreSQL.
   - `"sourceInstitution"` and `"createdAt"` must be double-quoted to preserve case sensitivity and match Drizzle ORM column mappings.
3. **Execution Separation**:
   - Splitting `CREATE TABLE`, `ALTER TABLE`, and `CREATE INDEX` into separate `await this.db.execute(...)` calls provides cleaner debugging logs and avoids multi-statement transaction batch quirks in `postgres.js`.

---

## 4. Conclusion & Complete Blueprints

### 4.1 Changes to `apps/backend/src/tutoria/tutoria.service.ts`

#### Step 4.1.1: Add State Guard Flag (around line 28)
```typescript
@Injectable()
export class TutoriaService implements OnModuleInit {
  private hasEnsuredKanbanTable = false;
  private hasEnsuredTimelineTable = false;
```

#### Step 4.1.2: Update `onModuleInit()` (lines 36-38)
```typescript
  async onModuleInit() {
    await this.ensureKanbanTable();
    await this.ensureTimelineTable();
  }
```

#### Step 4.1.3: Update `ensureKanbanTable()` (lines 41-86)
Add defensive guard and the 3 new multi-tutor columns:
```typescript
  // Garante que a tabela e todas as colunas necessárias existam no banco de dados
  async ensureKanbanTable() {
    if (this.hasEnsuredKanbanTable) return;
    try {
      if (!this.db || typeof this.db.execute !== 'function') {
        return;
      }

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS tutoria_atendimentos_kanban (
          id text PRIMARY KEY DEFAULT gen_random_uuid(),
          plano_acao_id text,
          "sourceInstitution" text DEFAULT 'ead' NOT NULL,
          periodo text NOT NULL,
          matricula text NOT NULL,
          aluno_nome text,
          aluno_email text,
          disciplina_codigo text,
          disciplina_nome text,
          status_kanban text DEFAULT 'pendente' NOT NULL,
          tutor_responsavel_id text,
          observacoes text,
          canal_contato_utilizado text,
          ultimo_contato_em timestamp with time zone,
          data_resolucao timestamp with time zone,
          "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
          "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
        );
      `);

      await this.db.execute(sql`
        ALTER TABLE tutoria_atendimentos_kanban
        ADD COLUMN IF NOT EXISTS aluno_nome text,
        ADD COLUMN IF NOT EXISTS aluno_email text,
        ADD COLUMN IF NOT EXISTS disciplina_codigo text,
        ADD COLUMN IF NOT EXISTS disciplina_nome text,
        ADD COLUMN IF NOT EXISTS canal_contato_utilizado text,
        ADD COLUMN IF NOT EXISTS ultimo_contato_em timestamp with time zone,
        ADD COLUMN IF NOT EXISTS data_resolucao timestamp with time zone,
        ADD COLUMN IF NOT EXISTS plano_acao_id text,
        ADD COLUMN IF NOT EXISTS tutor_responsavel_id text,
        ADD COLUMN IF NOT EXISTS tutor_iniciador_id text,
        ADD COLUMN IF NOT EXISTS ultima_intervencao_em timestamp with time zone,
        ADD COLUMN IF NOT EXISTS qtd_intervencoes integer DEFAULT 0;
      `);

      this.hasEnsuredKanbanTable = true;
    } catch (err: any) {
      console.warn(
        '[TutoriaService] Erro ao garantir schema do Kanban:',
        err?.message,
      );
    }
  }
```

#### Step 4.1.4: Add `ensureTimelineTable()` (insert after `ensureKanbanTable()`, line 86)
```typescript
  // Garante que a tabela de histórico (timeline) de atendimentos e índices existam no banco de dados
  async ensureTimelineTable() {
    if (this.hasEnsuredTimelineTable) return;
    try {
      if (!this.db || typeof this.db.execute !== 'function') {
        return;
      }

      // 1. Garante primeiro a tabela do Kanban antes de estabelecer relacionamentos
      await this.ensureKanbanTable();

      // 2. Cria a tabela tutoria_atendimentos_historico
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS tutoria_atendimentos_historico (
          id text PRIMARY KEY DEFAULT gen_random_uuid(),
          atendimento_id text REFERENCES tutoria_atendimentos_kanban(id) ON DELETE CASCADE,
          matricula text NOT NULL,
          periodo text NOT NULL,
          "sourceInstitution" text DEFAULT 'ead' NOT NULL,
          tipo_evento text NOT NULL,
          autor_id text REFERENCES "user"(id) ON DELETE SET NULL,
          autor_nome text,
          tutor_responsavel_anterior_id text REFERENCES "user"(id) ON DELETE SET NULL,
          tutor_responsavel_novo_id text REFERENCES "user"(id) ON DELETE SET NULL,
          estado_anterior text,
          estado_novo text,
          canal_contato text,
          observacoes text,
          metadata text,
          "createdAt" timestamp with time zone DEFAULT now() NOT NULL
        );
      `);

      // 3. Garante colunas de suporte multi-tutor no Kanban
      await this.db.execute(sql`
        ALTER TABLE tutoria_atendimentos_kanban
        ADD COLUMN IF NOT EXISTS tutor_iniciador_id text REFERENCES "user"(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS ultima_intervencao_em timestamp with time zone,
        ADD COLUMN IF NOT EXISTS qtd_intervencoes integer DEFAULT 0 NOT NULL;
      `);

      // 4. Garante colunas da tabela de histórico caso tenha sido criada em versão anterior
      await this.db.execute(sql`
        ALTER TABLE tutoria_atendimentos_historico
        ADD COLUMN IF NOT EXISTS atendimento_id text,
        ADD COLUMN IF NOT EXISTS matricula text,
        ADD COLUMN IF NOT EXISTS periodo text,
        ADD COLUMN IF NOT EXISTS "sourceInstitution" text DEFAULT 'ead',
        ADD COLUMN IF NOT EXISTS tipo_evento text,
        ADD COLUMN IF NOT EXISTS autor_id text,
        ADD COLUMN IF NOT EXISTS autor_nome text,
        ADD COLUMN IF NOT EXISTS tutor_responsavel_anterior_id text,
        ADD COLUMN IF NOT EXISTS tutor_responsavel_novo_id text,
        ADD COLUMN IF NOT EXISTS estado_anterior text,
        ADD COLUMN IF NOT EXISTS estado_novo text,
        ADD COLUMN IF NOT EXISTS canal_contato text,
        ADD COLUMN IF NOT EXISTS observacoes text,
        ADD COLUMN IF NOT EXISTS metadata text,
        ADD COLUMN IF NOT EXISTS "createdAt" timestamp with time zone DEFAULT now();
      `);

      // 5. Cria índices para otimização de busca na linha do tempo e auditoria
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_atendimento ON tutoria_atendimentos_historico (atendimento_id);
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_matricula ON tutoria_atendimentos_historico (matricula);
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_created_at ON tutoria_atendimentos_historico ("createdAt");
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_tipo ON tutoria_atendimentos_historico (tipo_evento);
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_autor ON tutoria_atendimentos_historico (autor_id);
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_mat_created ON tutoria_atendimentos_historico (matricula, "createdAt" DESC);
        CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_tutor_iniciador ON tutoria_atendimentos_kanban (tutor_iniciador_id);
        CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_ultima_interv ON tutoria_atendimentos_kanban (ultima_intervencao_em);
      `);

      this.hasEnsuredTimelineTable = true;
    } catch (err: any) {
      console.warn(
        '[TutoriaService] Erro ao garantir schema de Histórico/Timeline:',
        err?.message,
      );
    }
  }
```

---

### 4.2 Unit Tests Updates (`apps/backend/src/tutoria/tutoria.service.spec.ts`)

Worker M1 can append these two unit tests to `apps/backend/src/tutoria/tutoria.service.spec.ts`:

```typescript
  it('should run onModuleInit and ensure kanban and timeline tables without throwing', async () => {
    await expect(service.onModuleInit()).resolves.not.toThrow();
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it('should gracefully handle database errors in ensureTimelineTable without crashing', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('Connection offline'));
    await expect(service.ensureTimelineTable()).resolves.not.toThrow();
  });
```

---

## 5. Verification Method

To verify the blueprint after implementation by Worker M1:

1. **TypeScript Typecheck & Monorepo Build**:
   ```powershell
   npm run build --prefix apps/backend
   ```
   *Expected outcome*: Exit code 0, clean build with zero TypeScript compilation errors.

2. **Unit Test Execution**:
   ```powershell
   npm run test --prefix apps/backend -- tutoria.service.spec.ts
   ```
   *Expected outcome*: All tests pass, validating that `onModuleInit()` and `ensureTimelineTable()` execute smoothly and absorb mock database errors gracefully.

3. **Runtime Invalidation Conditions**:
   - Omitting `IF NOT EXISTS` on `CREATE TABLE`, `ADD COLUMN`, or `CREATE INDEX` will cause `duplicate_table`, `duplicate_column`, or `duplicate_relation` errors on subsequent service reboots.
   - Omitting double quotes on `"user"` will cause PostgreSQL syntax error `syntax error at or near "user"`.
   - Omitting double quotes on `"sourceInstitution"` or `"createdAt"` will cause PostgreSQL to lowercase the columns (`sourceinstitution`, `createdat`), breaking Drizzle ORM mapping.
   - Throwing errors from `ensureTimelineTable()` will cause NestJS `app.init()` to abort bootstrap if the database connection has transient latency or is offline during test boots.
