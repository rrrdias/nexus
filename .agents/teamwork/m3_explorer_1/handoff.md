# Investigation & Architecture Report: Server Actions for Tutoria (Milestone 3)

**Author**: `m3_explorer_1` (teamwork_explorer)  
**Recipient**: Parent Orchestrator (`5e78f035-a206-421e-9e96-62fa21d6fe12`)  
**Timestamp**: 2026-11-10T21:51:00Z  
**Scope**: Server Actions (`apps/frontend/src/app/actions/tutoria.ts` and `api.ts`), Backend Alignment, DTOs & Schema Interfaces  
**Status**: INVESTIGATION COMPLETE (Actionable Handoff)

---

## 1. Observation

A comprehensive inspection of the frontend and backend codebases was conducted:

### 1.1 Existing `apps/frontend/src/app/actions/api.ts`
- **Location**: lines 1-52.
- **Function**: `fetchFromApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T>`.
- **Token Resolution**:
  - Direct environment variable check: `process.env.TEST_AUTH_TOKEN` (lines 6-7).
  - NextAuth session fallback: `(await auth())?.user?.accessToken` (lines 8-9).
  - If token is absent: calls `await signOut({ redirectTo: "/nexus/login" })` (lines 11-13).
- **Endpoint Resolution**:
  - `baseUrl`: `process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3004"` (line 16).
  - Target URL: `${baseUrl}${endpoint}` (line 17).
- **HTTP Execution & Headers**:
  - Automatically injects `"Content-Type": "application/json"` and `"Authorization": "Bearer ${token}"` (lines 24-25).
  - Merges caller `options.headers`.
- **Status Handling**:
  - If `response.status === 401`: triggers `signOut` (lines 29-31).
  - If `!response.ok`: extracts JSON body via `await response.json().catch(() => null)`. Throws `new Error(error?.message || error?.error || 'Erro HTTP ${response.status} na API.')` (lines 33-36).
- **Exception & Redirect Handling**:
  - Explicitly preserves Next.js server redirection:
    ```ts
    if (
      error?.message === 'NEXT_REDIRECT' ||
      (typeof error?.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))
    ) {
      throw error;
    }
    ```
  - Logs network/server failures: `console.error('[API Fetch Error] Failed to connect to ${url}:', error)` (line 48).
  - Re-throws normalized `new Error(error.message || "Erro de conexão com o backend.")` (line 49).

### 1.2 Backend Database Schema (`apps/backend/src/db/schema.ts`)
- **Table `tutoria_atendimentos_historico`** (lines 813-858):
  - `id`: `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())`
  - `atendimentoId`: `text('atendimento_id').references(() => tutoriaAtendimentosKanban.id, { onDelete: 'cascade' })` (nullable)
  - `matricula`: `text('matricula').notNull()`
  - `periodo`: `text('periodo').notNull()`
  - `sourceInstitution`: `text('sourceInstitution').default('ead').notNull()`
  - `tipoEvento`: `text('tipo_evento').notNull()`
  - `autorId`: `text('autor_id').references(() => users.id, { onDelete: 'set null' })` (nullable)
  - `autorNome`: `text('autor_nome')` (nullable/string)
  - `tutorResponsavelAnteriorId`: `text('tutor_responsavel_anterior_id')` (nullable)
  - `tutorResponsavelNovoId`: `text('tutor_responsavel_novo_id')` (nullable)
  - `estadoAnterior`: `text('estado_anterior')` (nullable)
  - `estadoNovo`: `text('estado_novo')` (nullable)
  - `canalContato`: `text('canal_contato')` (nullable)
  - `observacoes`: `text('observacoes')` (nullable)
  - `metadata`: `text('metadata')` (nullable; JSON string or text)
  - `createdAt`: `timestamp('createdAt', { mode: 'date' }).defaultNow().notNull()`
- **Enums & Types** (lines 893-913):
  - `TutoriaTipoEvento`: `'abertura' | 'mudanca_status' | 'contato_enviado' | 'intervencao_manual' | 'passagem_bastao' | 'finalizacao' | 'reabertura'`
  - `TutoriaCanalContato`: `'whatsapp' | 'email' | 'telefone' | 'ava' | 'outro'`

### 1.3 Backend DTOs & Controllers
- **`CreateIntervencaoDto`** (`apps/backend/src/tutoria/dto/create-intervencao.dto.ts`):
  - `matricula`: string (required)
  - `atendimentoId`: string (optional)
  - `periodo`: string (optional)
  - `tipoEvento`: `TutoriaTipoEvento` (required)
  - `canalContato`: `TutoriaCanalContato` (optional)
  - `observacoes`: string (required non-empty)
  - `statusKanban`: string (optional)
  - `metadata`: any (optional)
- **Controller Endpoints** (`apps/backend/src/tutoria/tutoria.controller.ts`):
  1. `GET /api/tutoria/aluno/:matricula/timeline` (`@Query('atendimentoId')` optional) -> returns `200 OK` with JSON array of events (`TimelineEvent[]`).
  2. `POST /api/tutoria/intervencoes` -> returns `201 Created` with created event object (`TimelineEvent`).
  3. `GET /api/tutoria/tutores` -> returns `200 OK` with JSON array `ActiveTutor[]` (`[{ id, name, email }]`).
  4. `POST /api/tutoria/kanban/:id/transferir` -> returns `200 OK` with `{ success: true, card, evento }`.
- **Service Logic** (`apps/backend/src/tutoria/tutoria.service.ts`):
  - `getTimelineAluno` (lines 1412-1515): retrieves events ordered by `createdAt ASC`, parses `metadata` from JSON string, and if 0 events exist, queries `tutoria_atendimentos_kanban` to return a synthetic `legacy-${card.id}` opening event.
  - `registrarIntervencao` (lines 1114-1284): increments `qtd_intervencoes`, updates `ultima_intervencao_em = now()`, persists event in `tutoria_atendimentos_historico`, snapshots acting author from `users` (or fallback).
  - `getTutoresAtivos` (lines 1526-1530): queries `SELECT id, name, email FROM "user" WHERE "isActive" = true ORDER BY name ASC;`.

### 1.4 Frontend Existing Code & Verification State
- **`apps/frontend/src/app/actions/tutoria.ts`** currently defines:
  - `getTutoriaTimeline(matricula, atendimentoId)` returning `{ success: boolean, events: TimelineEvent[], error?: string }`
  - `createTutoriaIntervencao(data: CreateTutoriaIntervencaoInput)` returning `{ success: boolean, data?: any, id?: string, error?: string }`
  - `getTutoresAtivos()` returning `{ success: boolean, tutores: ActiveTutor[], error?: string }`
- **`apps/frontend/src/lib/tutoria-e2e.test.ts`**:
  - 16 tests executed via `npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts` (exit code 0, 16 passed, 0 failed).
  - Tests directly inspect:
    - `res.events` from `getTutoriaTimeline` (line 137).
    - `res.success` from `createTutoriaIntervencao` (line 158).
    - `res.tutores` from `getTutoresAtivos` (line 192).
- **`SCOPE.md` Specifications for Milestone 3**:
  - `getTutoriaTimeline`: expects `data?: TimelineEvent[]`.
  - `createTutoriaIntervention`: expects name with English spelling (`createTutoriaIntervention`) and input `CreateInterventionInput`.
  - `getTutoriaTutores`: expects name `getTutoriaTutores()` returning `data?: { id: string; name: string; email: string }[]`.

---

## 2. Logic Chain

1. **Reconciliation of Naming Conventions**:
   - `SCOPE.md` specifies:
     - `createTutoriaIntervention(data: CreateInterventionInput)`
     - `getTutoriaTutores()`
     - Return envelope using `data?: ...`
   - Existing tests in `apps/frontend/src/lib/tutoria-e2e.test.ts` call:
     - `createTutoriaIntervencao(data)`
     - `getTutoresAtivos()`
     - Return envelope inspecting `res.events` and `res.tutores`
   - **Deduction**: We must support both sets of names and return shapes simultaneously.
     - For `getTutoriaTimeline`: return `{ success: true, data: events, events }`.
     - For `getTutoriaTutores`: return `{ success: true, data: tutores, tutores }`, and export `getTutoresAtivos = getTutoriaTutores`.
     - For `createTutoriaIntervention`: export `createTutoriaIntervention` and alias `createTutoriaIntervencao = createTutoriaIntervention`. Also export both `CreateInterventionInput` and `CreateTutoriaIntervencaoInput`.
     - This guarantees 100% compliance with `SCOPE.md` while ensuring 0 test regressions in `tutoria-e2e.test.ts`.

2. **Error Handling Architecture**:
   - `fetchFromApi` extracts backend error messages (`error?.message || error?.error`) and throws standard JavaScript `Error`s.
   - When the backend returns 400 (e.g. `BadRequestException('Matrícula é obrigatória.')`), `fetchFromApi` throws `Error('Matrícula é obrigatória.')`.
   - The Server Action wraps `fetchFromApi` calls in `try / catch (err: any)`.
   - When caught:
     - Log error: `console.error('[ActionName] Erro:', err?.message)`
     - Return structured error payload: `{ success: false, error: err?.message || 'Fallback error message', ...defaults }`.
     - Do not let unexpected exceptions crash Next.js server components or bubble as unhandled rejections to client boundaries.
   - Pre-dispatch guard validation:
     - For `getTutoriaTimeline`: validate `matricula` is non-empty before making network calls.
     - For `createTutoriaIntervention`: validate `matricula` and `observacoes` are non-empty before making network calls (verified by test `TC-T2-F8-01`).

3. **Backend DTO & Database Schema Alignment**:
   - Database column `tutoria_atendimentos_historico.tipo_evento` allows 7 values:
     `'abertura' | 'mudanca_status' | 'contato_enviado' | 'intervencao_manual' | 'passagem_bastao' | 'finalizacao' | 'reabertura'`.
   - Frontend `TimelineEvent.tipoEvento` must type all 7 values as `TutoriaTipoEvento`.
   - Channel enum `TutoriaCanalContato` matches `'whatsapp' | 'email' | 'telefone' | 'ava' | 'outro'`.
   - `metadata` in backend is stored as text (JSON stringified) and parsed to an object when returned. In frontend `TimelineEvent`, `metadata?: any` accommodates objects or parsed dictionaries.
   - Author fields: `autorId` can be `null` (e.g. system generated or deleted user), `autorNome` is always a string.
   - `createdAt` is formatted by backend as ISO-8601 string (`new Date().toISOString()`), which maps to `string` in frontend TypeScript.

---

## 3. Caveats

1. **Read-Only Investigation**:
   In strict accordance with the Teamwork Explorer identity and parent instructions, no source code was directly modified during this step. All code snippets below are actionable blueprints for the Worker agent (`m3_worker_1` or equivalent).
2. **NextAuth Session Token**:
   `fetchFromApi` relies on `auth()` to extract `session.user.accessToken`. In development/testing environments without NextAuth cookies, `process.env.TEST_AUTH_TOKEN` is automatically used.
3. **Cache Policy**:
   All dynamic actions (`getTutoriaTimeline`, `getTutoriaTutores`, `getTutoriaEngagementList`) must explicitly set `cache: 'no-store'` in `fetchFromApi` options to avoid Next.js caching stale audit or attendance data.

---

## 4. Conclusion & Actionable Design

### 4.1 Exact TypeScript Interfaces

These interfaces should be defined and exported in `apps/frontend/src/app/actions/tutoria.ts`:

```typescript
// ============================================================================
// Multi-Tutor Hybrid Attendance, Timeline & Audit Trail Types
// ============================================================================

export type TutoriaTipoEvento =
  | 'abertura'
  | 'mudanca_status'
  | 'contato_enviado'
  | 'intervencao_manual'
  | 'passagem_bastao'
  | 'finalizacao'
  | 'reabertura'

export type TutoriaCanalContato =
  | 'whatsapp'
  | 'email'
  | 'telefone'
  | 'ava'
  | 'outro'

export interface TimelineEvent {
  id: string
  atendimentoId?: string | null
  matricula: string
  periodo?: string
  sourceInstitution?: string
  tipoEvento: TutoriaTipoEvento
  autorId?: string | null
  autorNome: string
  tutorResponsavelAnteriorId?: string | null
  tutorResponsavelNovoId?: string | null
  estadoAnterior?: string | null
  estadoNovo?: string | null
  canalContato?: TutoriaCanalContato | null
  observacoes?: string | null
  metadata?: any
  createdAt: string
}

export interface ActiveTutor {
  id: string
  name: string
  email: string
}

export type TutorResponsavel = ActiveTutor

export interface CreateInterventionInput {
  matricula: string
  atendimentoId?: string | null
  periodo?: string | null
  tipoEvento:
    | 'intervencao_manual'
    | 'contato_enviado'
    | 'abertura'
    | 'mudanca_status'
    | 'passagem_bastao'
    | 'finalizacao'
    | 'reabertura'
  canalContato?: TutoriaCanalContato | null
  observacoes: string
  statusKanban?: string | null
  metadata?: any
}

export type CreateTutoriaIntervencaoInput = CreateInterventionInput

export interface TransferirTutoriaBastaoInput {
  novoTutorId: string
  notaTransicao: string
}
```

---

### 4.2 Exact Server Action Implementations

#### Action 1: `getTutoriaTimeline`
```typescript
/**
 * Consulta a linha do tempo cronológica consolidada de intervenções e eventos de um discente.
 * Rota backend: GET /api/tutoria/aluno/:matricula/timeline(?atendimentoId=...)
 */
export async function getTutoriaTimeline(
  matricula: string,
  atendimentoId?: string,
): Promise<{
  success: boolean
  data: TimelineEvent[]
  events: TimelineEvent[]
  error?: string
}> {
  if (!matricula || matricula.trim().length === 0) {
    return {
      success: false,
      data: [],
      events: [],
      error: "Matrícula é obrigatória.",
    }
  }

  try {
    const query = atendimentoId ? `?atendimentoId=${encodeURIComponent(atendimentoId.trim())}` : ""
    const res = await fetchFromApi<TimelineEvent[] | { events?: TimelineEvent[]; data?: TimelineEvent[] }>(
      `/api/tutoria/aluno/${encodeURIComponent(matricula.trim())}/timeline${query}`,
      {
        method: "GET",
        cache: "no-store",
      },
    )
    const events: TimelineEvent[] = Array.isArray(res) ? res : res?.events || res?.data || []
    return {
      success: true,
      data: events,
      events,
    }
  } catch (err: any) {
    console.error("[getTutoriaTimeline] Erro:", err?.message)
    return {
      success: false,
      data: [],
      events: [],
      error: err?.message || "Erro ao carregar histórico.",
    }
  }
}
```

#### Action 2: `createTutoriaIntervention` (with alias `createTutoriaIntervencao`)
```typescript
/**
 * Registra intervenções pedagógicas ou tentativas/envios de contato na trilha de auditoria.
 * Rota backend: POST /api/tutoria/intervencoes
 */
export async function createTutoriaIntervention(
  data: CreateInterventionInput,
): Promise<{
  success: boolean
  data?: TimelineEvent
  id?: string
  error?: string
}> {
  if (!data.matricula || data.matricula.trim().length === 0) {
    return {
      success: false,
      error: "Matrícula é obrigatória.",
    }
  }

  if (!data.observacoes || data.observacoes.trim().length === 0) {
    return {
      success: false,
      error: "Observações são obrigatórias para registrar intervenção.",
    }
  }

  try {
    const payload = {
      ...data,
      matricula: data.matricula.trim(),
      observacoes: data.observacoes.trim(),
      atendimentoId: data.atendimentoId?.trim() || undefined,
      periodo: data.periodo?.trim() || undefined,
      canalContato: data.canalContato || undefined,
      statusKanban: data.statusKanban || undefined,
    }

    const res = await fetchFromApi<TimelineEvent>('/api/tutoria/intervencoes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    return {
      success: true,
      data: res,
      id: res?.id,
      ...(typeof res === 'object' && res !== null ? res : {}),
    }
  } catch (err: any) {
    console.error("[createTutoriaIntervention] Erro:", err?.message)
    return {
      success: false,
      error: err?.message || "Erro ao registrar intervenção.",
    }
  }
}

// Alias para compatibilidade total com suíte de testes existente
export const createTutoriaIntervencao = createTutoriaIntervention
```

#### Action 3: `getTutoriaTutores` (with alias `getTutoresAtivos`)
```typescript
/**
 * Consulta a lista de tutores ativos no sistema para seleção em dropdowns e passagens de bastão.
 * Rota backend: GET /api/tutoria/tutores
 */
export async function getTutoriaTutores(): Promise<{
  success: boolean
  data: ActiveTutor[]
  tutores: ActiveTutor[]
  error?: string
}> {
  try {
    const res = await fetchFromApi<ActiveTutor[] | { tutores?: ActiveTutor[]; data?: ActiveTutor[] }>(
      '/api/tutoria/tutores',
      {
        method: 'GET',
        cache: 'no-store',
      },
    )
    const tutores: ActiveTutor[] = Array.isArray(res) ? res : res?.tutores || res?.data || []
    return {
      success: true,
      data: tutores,
      tutores,
    }
  } catch (err: any) {
    console.error("[getTutoriaTutores] Erro:", err?.message)
    return {
      success: false,
      data: [],
      tutores: [],
      error: err?.message || "Erro ao buscar tutores.",
    }
  }
}

// Alias para compatibilidade total com suíte de testes existente
export const getTutoresAtivos = getTutoriaTutores
```

---

## 5. Verification Method

To independently verify the architecture and implementations without breaking existing contracts:

```powershell
# 1. Execute Frontend Standalone E2E & Server Actions Test Suite (16 tests)
npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts

# 2. Verify Frontend TypeScript Compilation (Target: 0 errors)
npx tsc --noEmit -p apps/frontend/tsconfig.json

# 3. Verify Frontend ESLint (Target: 0 errors)
npx eslint -c apps/frontend/eslint.config.mjs apps/frontend/src/app/actions/tutoria.ts apps/frontend/src/app/actions/api.ts

# 4. Verify Backend Tutoria Multi-Tutor Test Suite (Target: 83 tests passing)
npm run test:e2e --prefix apps/backend -- tutoria-multitutor.e2e-spec.ts
```

### Invalidation Conditions
- If any backend DTO changes field names (e.g. `matricula` renamed or `tipoEvento` enum extended without frontend update).
- If `fetchFromApi` alters its Bearer token structure or stops handling `NEXT_REDIRECT`.
- If `tutoria-e2e.test.ts` fails any of the 16 tests due to missing `res.events` or `res.tutores`.
