# Handoff Report: Drizzle Schema & Table Definitions (Milestone 1)

**Agent**: Explorer 1 (`explorer_m1_1`) — Drizzle Schema Specialist  
**Recipient**: Sub-Orchestrator M1 (`ace68dba-ed41-44d1-855e-edda9d576e4a`) / Worker M1  
**Timestamp**: 2026-11-10T20:36:00Z  
**Status**: Task Complete (Hard Handoff)

---

## 1. Observation

### 1.1 Existing Database Schema (`apps/backend/src/db/schema.ts`)
- **Imports (lines 1–13)**:
  `drizzle-orm/pg-core` imports `timestamp`, `pgTable`, `text`, `primaryKey`, `boolean`, `unique`, `uniqueIndex`, `index`, `integer`.
  `drizzle-orm` only imports `{ sql }`. Note that `relations` is **not** currently imported.
- **User Table Mapping (lines 14–30)**:
  ```typescript
  export const users = pgTable('user', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    ...
  });
  ```
  The Postgres table name is `'user'` (a reserved keyword requiring double-quotes in raw SQL: `"user"`).
- **Existing `tutoriaAtendimentosKanban` (lines 763–805)**:
  Currently ends at line 805 without any relations defined.
  Columns present: `id`, `planoAcaoId`, `sourceInstitution`, `periodo`, `matricula`, `alunoNome`, `alunoEmail`, `disciplinaCodigo`, `disciplinaNome`, `statusKanban`, `tutorResponsavelId`, `observacoes`, `canalContatoUtilizado`, `ultimoContatoEm`, `dataResolucao`, `createdAt`, `updatedAt`.
  Missing required columns: `tutorIniciadorId`, `ultimaIntervencaoEm`, `qtdIntervencoes`.
- **Existing Relations in `schema.ts`**:
  Search for `relations` in `schema.ts` yielded 0 matches. Currently no tables define `relations()`.

### 1.2 Existing Migrations and DDL Execution
- **`apps/backend/src/db/migrate-tutoria.ts` (lines 135–180)**:
  Uses idempotent raw SQL via `db.execute(sql\`...\`)`.
  Foreign keys reference `"user"(id) ON DELETE SET NULL`.
  Quoted camelCase column names: `"sourceInstitution"`, `"createdAt"`, `"updatedAt"`.
- **`apps/backend/src/tutoria/tutoria.service.ts` (lines 36–85)**:
  Implements `onModuleInit()` calling `ensureKanbanTable()`.
  Uses a boolean guard `hasEnsuredKanbanTable` and executes `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS`.
- **Package scripts (`apps/backend/package.json`, lines 17–20)**:
  ```json
  "db:migrate-tutoria": "ts-node src/db/migrate-tutoria.ts",
  "db:migrate-tutoria:prod": "node dist/db/migrate-tutoria.js",
  "db:migrate-tutoria-dates": "ts-node src/db/migrate-tutoria-dates.ts",
  "db:migrate-tutoria-dates:prod": "node dist/db/migrate-tutoria-dates.js",
  ```
  Note: `ts-node` is used for runtime migration scripts, **not** `tsx`. Neither `package.json` nor `apps/backend/package.json` has `tsx` installed. Therefore, migration scripts must be registered with `ts-node` (or `tsx` must be added as devDependency).

### 1.3 Baseline Monorepo Compilation
- Executed `npm run build --prefix apps/backend` (`nest build`):
  Result: exited with code 0 (clean compilation, no errors).

---

## 2. Logic Chain

1. **Table Schema Consistency**:
   - `tutoria_atendimentos_historico` represents immutable audit records and chronological timeline entries.
   - Per `SCOPE.md` and `DISPATCH.md`, it requires 16 columns:
     - `id`: primary key UUID text
     - `atendimentoId`: text nullable FK -> `tutoriaAtendimentosKanban.id` with `onDelete: 'cascade'`
     - `matricula`: text not null
     - `periodo`: text not null
     - `sourceInstitution`: text not null default 'ead'
     - `tipoEvento`: text not null (`abertura`, `mudanca_status`, `contato_enviado`, `intervencao_manual`, `passagem_bastao`, `finalizacao`, `reabertura`)
     - `autorId`: text nullable FK -> `users.id` with `onDelete: 'set null'`
     - `autorNome`: text nullable
     - `tutorResponsavelAnteriorId`: text nullable FK -> `users.id` with `onDelete: 'set null'`
     - `tutorResponsavelNovoId`: text nullable FK -> `users.id` with `onDelete: 'set null'`
     - `estadoAnterior`: text nullable
     - `estadoNovo`: text nullable
     - `canalContato`: text nullable (`whatsapp`, `email`, `telefone`, `ava`, `outro`)
     - `observacoes`: text nullable
     - `metadata`: text nullable (stores JSON string)
     - `createdAt`: timestamp with timezone/mode date defaultNow not null
   - 5 specified indexes are needed to optimize queries:
     - `idx_tutoria_hist_atendimento` on `atendimentoId` (for loading card-specific timeline)
     - `idx_tutoria_hist_matricula` on `matricula` (for loading discente-wide consolidated timeline)
     - `idx_tutoria_hist_created_at` on `createdAt` (for chronological ordering `ASC`/`DESC`)
     - `idx_tutoria_hist_tipo` on `tipoEvento` (for filtering events)
     - `idx_tutoria_hist_autor` on `autorId` (for tutor activity audits)

2. **`tutoriaAtendimentosKanban` Column Additions**:
   - `tutorIniciadorId`: text nullable FK -> `users.id` with `onDelete: 'set null'`
   - `ultimaIntervencaoEm`: timestamp nullable
   - `qtdIntervencoes`: integer default 0 not null
   - Index `idx_tutoria_kanban_tutor_iniciador` on `tutorIniciadorId` ensures fast queries for cards initiated by a specific tutor.

3. **Drizzle Disambiguation via `relationName`**:
   - In Drizzle ORM, when multiple foreign keys in a single table reference the same target table (e.g. `tutoriaAtendimentosHistorico` referencing `users` 3 times: `autorId`, `tutorResponsavelAnteriorId`, `tutorResponsavelNovoId`; and `tutoriaAtendimentosKanban` referencing `users` 2 times: `tutorResponsavelId`, `tutorIniciadorId`), Drizzle requires an explicit `relationName` to disambiguate the relations and avoid `AmbiguousRelationError` at runtime.
   - We assign clear, distinct `relationName`s:
     - `'kanbanTutorResponsavel'`
     - `'kanbanTutorIniciador'`
     - `'historicoAutor'`
     - `'historicoTutorAnterior'`
     - `'historicoTutorNovo'`
   - We define corresponding `usersRelations` with these exact names so relational queries (`db.query...`) work seamlessly bidirectionally.

4. **TypeScript Types**:
   - Using Drizzle's `$inferSelect` and `$inferInsert` ensures zero drift between database schema and TypeScript compile-time contracts.
   - We export `TutoriaAtendimentoHistorico`, `NewTutoriaAtendimentoHistorico`, `TutoriaAtendimentoKanban`, `NewTutoriaAtendimentoKanban`, and strongly typed union types `TutoriaTipoEvento` and `TutoriaCanalContato`.

5. **Runtime Migration & Bootstrap**:
   - `migrate-tutoria-multitutor.ts` (M1.2) and `ensureTimelineTable()` (M1.3) need identical idempotent SQL DDL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
   - Raw SQL must quote `"user"`, `"createdAt"`, and `"sourceInstitution"` to prevent Postgres syntax errors.

---

## 3. Caveats

1. **Read-Only Scope**: Explorer 1 did not modify `apps/backend/src/db/schema.ts` directly, strictly complying with the read-only investigation rule. All code blueprints below are copy-paste ready for Worker M1.
2. **Dual-Layer Database Sync**: The application uses both Drizzle schema definitions (for typing/ORM queries) and explicit raw SQL migration/bootstrap (`migrate-tutoria.ts` and `ensureKanbanTable()`). Worker M1 must ensure both layers are updated in tandem.
3. **Runner Script Dependency**: `apps/backend/package.json` uses `ts-node` across all existing migration scripts. Using `"db:migrate-tutoria-multitutor": "ts-node src/db/migrate-tutoria-multitutor.ts"` avoids introducing an uninstalled `tsx` dependency.

---

## 4. Conclusion & Precise Code Blueprints

### 4.1 Changes to `apps/backend/src/db/schema.ts`

#### Step 4.1.1: Update imports at top of `apps/backend/src/db/schema.ts` (around lines 1–13)
```typescript
// Replace line 12-13:
// import { sql } from 'drizzle-orm';
// With:
import { sql, relations } from 'drizzle-orm';
```

#### Step 4.1.2: Update `tutoriaAtendimentosKanban` (lines 763–805)
```typescript
export const tutoriaAtendimentosKanban = pgTable(
  'tutoria_atendimentos_kanban',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    planoAcaoId: text('plano_acao_id').references(() => tutoriaPlanosAcao.id, {
      onDelete: 'cascade',
    }),
    sourceInstitution: text('sourceInstitution').default('ead').notNull(),
    periodo: text('periodo').notNull(),
    matricula: text('matricula').notNull(),
    alunoNome: text('aluno_nome'),
    alunoEmail: text('aluno_email'),
    disciplinaCodigo: text('disciplina_codigo'),
    disciplinaNome: text('disciplina_nome'),

    // Status das colunas do Kanban:
    // 'pendente', 'em_contato', 'aguardando_retorno', 'em_recuperacao', 'revertido', 'evadido'
    statusKanban: text('status_kanban').default('pendente').notNull(),

    tutorResponsavelId: text('tutor_responsavel_id').references(
      () => users.id,
      {
        onDelete: 'set null',
      },
    ),
    tutorIniciadorId: text('tutor_iniciador_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    observacoes: text('observacoes'),
    canalContatoUtilizado: text('canal_contato_utilizado'), // 'whatsapp', 'email', 'telefone', 'ava'
    ultimoContatoEm: timestamp('ultimo_contato_em', { mode: 'date' }),
    dataResolucao: timestamp('data_resolucao', { mode: 'date' }),
    ultimaIntervencaoEm: timestamp('ultima_intervencao_em', { mode: 'date' }),
    qtdIntervencoes: integer('qtd_intervencoes').default(0).notNull(),

    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_tutoria_kanban_status').on(t.statusKanban),
    index('idx_tutoria_kanban_mat').on(t.matricula),
    index('idx_tutoria_kanban_plano').on(t.planoAcaoId),
    index('idx_tutoria_kanban_tutor').on(t.tutorResponsavelId),
    index('idx_tutoria_kanban_tutor_iniciador').on(t.tutorIniciadorId),
    index('idx_tutoria_kanban_periodo').on(t.periodo),
  ],
);
```

#### Step 4.1.3: Add `tutoriaAtendimentosHistorico` table definition (append after line 805)
```typescript
export const tutoriaAtendimentosHistorico = pgTable(
  'tutoria_atendimentos_historico',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    atendimentoId: text('atendimento_id').references(
      () => tutoriaAtendimentosKanban.id,
      {
        onDelete: 'cascade',
      },
    ),
    matricula: text('matricula').notNull(),
    periodo: text('periodo').notNull(),
    sourceInstitution: text('sourceInstitution').default('ead').notNull(),
    tipoEvento: text('tipo_evento').notNull(),
    autorId: text('autor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    autorNome: text('autor_nome'),
    tutorResponsavelAnteriorId: text('tutor_responsavel_anterior_id').references(
      () => users.id,
      {
        onDelete: 'set null',
      },
    ),
    tutorResponsavelNovoId: text('tutor_responsavel_novo_id').references(
      () => users.id,
      {
        onDelete: 'set null',
      },
    ),
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
    index('idx_tutoria_hist_autor').on(t.autorId),
  ],
);
```

#### Step 4.1.4: Add Relations Definitions (append after `tutoriaAtendimentosHistorico`)
```typescript
export const tutoriaAtendimentosKanbanRelations = relations(
  tutoriaAtendimentosKanban,
  ({ one, many }) => ({
    planoAcao: one(tutoriaPlanosAcao, {
      fields: [tutoriaAtendimentosKanban.planoAcaoId],
      references: [tutoriaPlanosAcao.id],
    }),
    tutorResponsavel: one(users, {
      fields: [tutoriaAtendimentosKanban.tutorResponsavelId],
      references: [users.id],
      relationName: 'kanbanTutorResponsavel',
    }),
    tutorIniciador: one(users, {
      fields: [tutoriaAtendimentosKanban.tutorIniciadorId],
      references: [users.id],
      relationName: 'kanbanTutorIniciador',
    }),
    historico: many(tutoriaAtendimentosHistorico),
  }),
);

export const tutoriaAtendimentosHistoricoRelations = relations(
  tutoriaAtendimentosHistorico,
  ({ one }) => ({
    atendimento: one(tutoriaAtendimentosKanban, {
      fields: [tutoriaAtendimentosHistorico.atendimentoId],
      references: [tutoriaAtendimentosKanban.id],
    }),
    autor: one(users, {
      fields: [tutoriaAtendimentosHistorico.autorId],
      references: [users.id],
      relationName: 'historicoAutor',
    }),
    tutorResponsavelAnterior: one(users, {
      fields: [tutoriaAtendimentosHistorico.tutorResponsavelAnteriorId],
      references: [users.id],
      relationName: 'historicoTutorAnterior',
    }),
    tutorResponsavelNovo: one(users, {
      fields: [tutoriaAtendimentosHistorico.tutorResponsavelNovoId],
      references: [users.id],
      relationName: 'historicoTutorNovo',
    }),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  kanbanAtendimentosComoResponsavel: many(tutoriaAtendimentosKanban, {
    relationName: 'kanbanTutorResponsavel',
  }),
  kanbanAtendimentosComoIniciador: many(tutoriaAtendimentosKanban, {
    relationName: 'kanbanTutorIniciador',
  }),
  historicoComoAutor: many(tutoriaAtendimentosHistorico, {
    relationName: 'historicoAutor',
  }),
  historicoComoTutorAnterior: many(tutoriaAtendimentosHistorico, {
    relationName: 'historicoTutorAnterior',
  }),
  historicoComoTutorNovo: many(tutoriaAtendimentosHistorico, {
    relationName: 'historicoTutorNovo',
  }),
}));
```

#### Step 4.1.5: Add TypeScript Exported Types (append at bottom of `schema.ts`)
```typescript
export type TutoriaAtendimentoHistorico =
  typeof tutoriaAtendimentosHistorico.$inferSelect;
export type NewTutoriaAtendimentoHistorico =
  typeof tutoriaAtendimentosHistorico.$inferInsert;

export type TutoriaAtendimentoKanban =
  typeof tutoriaAtendimentosKanban.$inferSelect;
export type NewTutoriaAtendimentoKanban =
  typeof tutoriaAtendimentosKanban.$inferInsert;

export type TutoriaTipoEvento =
  | 'abertura'
  | 'mudanca_status'
  | 'contato_enviado'
  | 'intervencao_manual'
  | 'passagem_bastao'
  | 'finalizacao'
  | 'reabertura';

export type TutoriaCanalContato =
  | 'whatsapp'
  | 'email'
  | 'telefone'
  | 'ava'
  | 'outro';
```

---

### 4.2 Blueprint for `apps/backend/package.json`
Add script in `scripts` block:
```json
"db:migrate-tutoria-multitutor": "ts-node src/db/migrate-tutoria-multitutor.ts",
"db:migrate-tutoria-multitutor:prod": "node dist/db/migrate-tutoria-multitutor.js",
```

---

### 4.3 Blueprint for Migration Script (`apps/backend/src/db/migrate-tutoria-multitutor.ts`)
```typescript
import { db } from './index';
import { sql } from 'drizzle-orm';

async function migrateMultiTutor() {
  console.log('🚀 Iniciando migração do modelo Multi-Tutor e Trilha de Histórico...');

  try {
    // 1. Criar tabela de histórico/linha do tempo
    await db.execute(sql`
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
    console.log('✅ Tabela tutoria_atendimentos_historico criada/verificada.');

    // 2. Adicionar novas colunas em tutoria_atendimentos_kanban
    await db.execute(sql`
      ALTER TABLE tutoria_atendimentos_kanban
      ADD COLUMN IF NOT EXISTS tutor_iniciador_id text REFERENCES "user"(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS ultima_intervencao_em timestamp with time zone,
      ADD COLUMN IF NOT EXISTS qtd_intervencoes integer DEFAULT 0 NOT NULL;
    `);
    console.log('✅ Novas colunas adicionadas em tutoria_atendimentos_kanban.');

    // 3. Criar índices para otimização de consultas
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_tutoria_hist_atendimento ON tutoria_atendimentos_historico (atendimento_id);
      CREATE INDEX IF NOT EXISTS idx_tutoria_hist_matricula ON tutoria_atendimentos_historico (matricula);
      CREATE INDEX IF NOT EXISTS idx_tutoria_hist_created_at ON tutoria_atendimentos_historico ("createdAt");
      CREATE INDEX IF NOT EXISTS idx_tutoria_hist_tipo ON tutoria_atendimentos_historico (tipo_evento);
      CREATE INDEX IF NOT EXISTS idx_tutoria_hist_autor ON tutoria_atendimentos_historico (autor_id);
      CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_tutor_iniciador ON tutoria_atendimentos_kanban (tutor_iniciador_id);
    `);
    console.log('✅ Índices de tutoria_atendimentos_historico criados/verificados.');

    console.log('🎉 Migração Multi-Tutor e Histórico concluída com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração Multi-Tutor da Tutoria:', err);
    process.exit(1);
  }
}

migrateMultiTutor();
```

---

### 4.4 Blueprint for `TutoriaService.ensureTimelineTable()` (`apps/backend/src/tutoria/tutoria.service.ts`)
```typescript
  private hasEnsuredTimelineTable = false;

  async ensureTimelineTable() {
    if (this.hasEnsuredTimelineTable) return;
    try {
      await this.ensureKanbanTable();

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

      await this.db.execute(sql`
        ALTER TABLE tutoria_atendimentos_kanban
        ADD COLUMN IF NOT EXISTS tutor_iniciador_id text REFERENCES "user"(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS ultima_intervencao_em timestamp with time zone,
        ADD COLUMN IF NOT EXISTS qtd_intervencoes integer DEFAULT 0 NOT NULL;
      `);

      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_atendimento ON tutoria_atendimentos_historico (atendimento_id);
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_matricula ON tutoria_atendimentos_historico (matricula);
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_created_at ON tutoria_atendimentos_historico ("createdAt");
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_tipo ON tutoria_atendimentos_historico (tipo_evento);
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_autor ON tutoria_atendimentos_historico (autor_id);
        CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_tutor_iniciador ON tutoria_atendimentos_kanban (tutor_iniciador_id);
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
And in `onModuleInit()`:
```typescript
  async onModuleInit() {
    await this.ensureKanbanTable();
    await this.ensureTimelineTable();
  }
```

---

## 5. Verification Method

Once Worker M1 applies the changes:
1. **Typecheck & Build**:
   ```bash
   npm run build --prefix apps/backend
   ```
   Must succeed with exit code 0.
2. **Explicit TypeScript Verification**:
   ```bash
   npx tsc --noEmit -p apps/backend/tsconfig.json
   ```
   Must produce zero diagnostic errors.
3. **Unit Tests Verification**:
   ```bash
   npm run test --prefix apps/backend -- tutoria.service.spec.ts
   ```
4. **Invalidation Conditions**:
   - Omitting `relationName` when referencing `users` multiple times will cause runtime errors in Drizzle's relation graph.
   - Using unquoted `user` or unquoted `createdAt` in raw PostgreSQL DDL will cause syntax errors (`"user"` is a reserved keyword; `createdAt` will be folded to lowercase `createdat` breaking ORM case sensitivity).
