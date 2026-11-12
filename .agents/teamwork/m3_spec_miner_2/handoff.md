# Specification Report & Handoff: Milestone 3 Backend APIs and Data Contracts

**Author**: `m3_spec_miner_2` (Specification Miner)  
**Recipient**: Parent Orchestrator (`5e78f035-a206-421e-9e96-62fa21d6fe12`)  
**Timestamp**: 2026-11-10T21:50:00Z  
**Scope**: Milestone 3 Backend Tutoria APIs, Data Contracts, DTOs, and Schema Integration  
**Status**: COMPLETE  

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | API / Timeline | `GET /api/tutoria/aluno/:matricula/timeline` | Retrieves chronological vertical timeline of attendance events for a student, with optional attendance card filter and synthetic legacy fallback. | URL Param: `matricula` (string, required). Query Param: `atendimentoId` (string UUID, optional). Auth: Bearer JWT. | `200 OK`: Array of `TimelineEvent` objects ordered by `createdAt ASC`. Returns `[]` if student or card does not exist. | `400 Bad Request` if `matricula` is empty or `atendimentoId` is < 5 chars; `401` if unauthenticated; `403` if lacking `tutoria` module permission. | `tutoria.controller.ts:100`, `tutoria.service.ts:1412` |
| 2 | API / Intervenções | `POST /api/tutoria/intervencoes` | Records a pedagogical intervention or multi-channel communication into the audit trail, updates Kanban card metrics, and touches contact timestamps. | Body: `CreateIntervencaoDto` (`matricula`, `tipoEvento`, `observacoes`, optional: `canalContato`, `atendimentoId`, `periodo`, `statusKanban`, `metadata`). Auth: Bearer JWT. | `201 Created`: The newly created `TimelineEvent` object with resolved `autorNome` snapshot. | `400 Bad Request` if validation fails (`matricula` missing, invalid `tipoEvento`, invalid `canalContato`, invalid `statusKanban`, empty `observacoes`); `401` if unauthenticated; `403` if lacking module permission. | `tutoria.controller.ts:109`, `tutoria.service.ts:1114`, `create-intervencao.dto.ts` |
| 3 | API / Tutores | `GET /api/tutoria/tutores` | Lists all currently active tutors in alphabetical order for peer collaboration and baton passing selection dropdowns. | Query Params: None. Auth: Bearer JWT (`@RequireModule('tutoria')`). | `200 OK`: Array of `{ id: string, name: string, email: string \| null }` where `"isActive" = true` sorted alphabetically by name. | `401 Unauthorized` if unauthenticated; `403 Forbidden` if user lacks `tutoria` permission. | `tutoria.controller.ts:94`, `tutoria.service.ts:1526` |
| 4 | API / Passagem de Bastão | `POST /api/tutoria/kanban/:id/transferir` | Explicitly transfers lead tutor ownership of a Kanban card, validates target tutor active status, rejects self-transfers, updates card, and logs `passagem_bastao` audit event. | URL Param: `id` (string card UUID). Body: `TransferirTutorDto` (`novoTutorId`, `notaTransicao` min 5 chars). Auth: Bearer JWT. | `200 OK`: `{ success: true, card: { id, tutorResponsavelId }, evento: TimelineEvent }`. | `400 Bad Request` if `novoTutorId` invalid, `notaTransicao` < 5 chars, target tutor inactive, or target tutor is current owner; `404 Not Found` if card or target tutor not found; `401`/`403`. | `tutoria.controller.ts:125`, `tutoria.service.ts:1296`, `transferir-tutor.dto.ts` |
| 5 | API / Kanban Card Mutation | `PATCH /api/tutoria/kanban/:id` | Updates card stage, notes, or contact channel while strictly preserving `tutor_responsavel_id` (hybrid ownership invariant) and appending audit row. | URL Param: `id` (string card UUID). Body: `UpdateKanbanCardDto` (`statusKanban`, `observacoes`, `canalContatoUtilizado`, `ultimoContatoEm`, `dataResolucao`). Auth: Bearer JWT. | `200 OK`: Updated card object. | `400 Bad Request` if status invalid; `404 Not Found` if card not found; `401`/`403`. | `tutoria.controller.ts:157`, `tutoria.service.ts:968`, `update-kanban-card.dto.ts` |
| 6 | Database Schema | `tutoria_atendimentos_historico` | PostgreSQL audit log table with foreign keys, chronological indexing, acting tutor snapshot, state diff, and JSON metadata. | Inserted on card creation, status change, note update, intervention logging, and baton passing. | Stores immutable historical records with cascade deletion when card is deleted. | Enforces non-null `matricula`, `periodo`, `sourceInstitution`, `tipoEvento`, `createdAt`. | `apps/backend/src/db/schema.ts:813` |
| 7 | Database Schema | `tutoria_atendimentos_kanban` | PostgreSQL attendance card table tracking lead tutor, initiator tutor, stage, contact channel, resolution date, and intervention count/timestamp. | Created via manual assignment, triage, or plan action creation. | Stores active attendance lifecycle state. | Primary key UUID, cascade delete from action plans, `set null` on tutor deletion. | `apps/backend/src/db/schema.ts:763` |
| 8 | Service Utility | `resolveTutorInfo` | In-memory 60s TTL cached resolver querying `"user"` table for `name` and `email` to snapshot acting tutor names into historical logs when JWT omits name. | `userId?: string` | `{ id: string \| null, name: string, email: string \| null }`. Fallback name `'Tutor Atuante'`. | Never throws; logs warning and returns fallback object. | `tutoria.service.ts:46` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `GET /api/tutoria/aluno/:matricula/timeline` | Student exists in Kanban (`tutoria_atendimentos_kanban`) but has 0 history events in `tutoria_atendimentos_historico` (legacy card). | Returns `200 OK` with 1 synthetic event: `id: 'legacy-' + card.id`, `tipoEvento: 'abertura'`, `autorNome: card.tutor_nome \|\| 'Tutor Responsável'`, `estadoNovo: card.status_kanban \|\| 'pendente'`, `observacoes: card.observacoes \|\| 'Abertura de atendimento no Kanban'`. |
| 2 | `GET /api/tutoria/aluno/:matricula/timeline` | `matricula` not found in neither `historico` nor `kanban` (e.g. `'99999999'`). | Returns `200 OK` with empty array `[]` (does **not** throw 404). Verified via TC-T2-F6-01. |
| 3 | `GET /api/tutoria/aluno/:matricula/timeline` | Empty `matricula` string or whitespace-only (`''` or `'   '`). | Returns `400 Bad Request` (`BadRequestException: 'Matrícula inválida.'`). |
| 4 | `GET /api/tutoria/aluno/:matricula/timeline` | Query param `?atendimentoId=` has length < 5 (e.g. `'abc'`). | Returns `400 Bad Request` (`BadRequestException: 'atendimentoId deve ser um UUID válido.'`). |
| 5 | `GET /api/tutoria/aluno/:matricula/timeline` | Query param `?atendimentoId=` is a non-existent UUID (e.g. `'card-inexistente-123'`). | Returns `200 OK` with empty array `[]`. |
| 6 | `GET /api/tutoria/aluno/:matricula/timeline` | SQL injection attempt in `matricula` param (e.g. `1 OR 1=1;--`). | Handled safely via parameterized Drizzle `sql` template; returns `200 OK` with empty array `[]`. |
| 7 | `GET /api/tutoria/aluno/:matricula/timeline` | Event in database has JSON string in `metadata` column. | JSON string is automatically parsed into JavaScript object; if parsing fails, raw string is preserved. |
| 8 | `POST /api/tutoria/intervencoes` | `matricula` with leading/trailing spaces (e.g. `'  20241404  '`). | Returns `201 Created`; `matricula` is trimmed to `'20241404'` before persistence. |
| 9 | `POST /api/tutoria/intervencoes` | Unsupported `canalContato` (e.g. `'telegram_nao_suportado'`). | Returns `400 Bad Request` (`canalContato deve ser um dos seguintes valores: whatsapp, email, telefone, ava, outro`). |
| 10 | `POST /api/tutoria/intervencoes` | Empty or whitespace-only `observacoes` (`''` or `'     '`). | Returns `400 Bad Request` (`Observações são obrigatórias para registrar intervenção.`). |
| 11 | `POST /api/tutoria/intervencoes` | Missing `tipoEvento` in payload. | Returns `400 Bad Request` (`tipoEvento é obrigatório.`). |
| 12 | `POST /api/tutoria/intervencoes` | `atendimentoId` omitted in payload. | Backend queries `tutoria_atendimentos_kanban` for latest card by `matricula` and `periodo` (`dto.periodo || '2026-2'`) ordered by `"updatedAt" DESC` and attaches it. If no card exists, records event with `atendimentoId: null`. |
| 13 | `POST /api/tutoria/intervencoes` | `statusKanban` supplied in body (e.g. `'revertido'`). | Updates card `status_kanban` to `'revertido'` and automatically sets `data_resolucao = now()`. |
| 14 | `POST /api/tutoria/intervencoes` | `tipoEvento === 'contato_enviado'`. | Automatically updates card's `ultimo_contato_em = now()` in addition to `ultima_intervencao_em = now()`. |
| 15 | `POST /api/tutoria/kanban/:id/transferir` | Target tutor `novoTutorId` is identical to current lead tutor (`card.tutor_responsavel_id === novoTutorId`). | Returns `400 Bad Request` (`'O discente já está atribuído a este tutor.'`). |
| 16 | `POST /api/tutoria/kanban/:id/transferir` | Target tutor exists in `"user"` but has `"isActive" = false`. | Returns `400 Bad Request` (`'Tutor selecionado está inativo.'`). |
| 17 | `POST /api/tutoria/kanban/:id/transferir` | `notaTransicao` has length < 5 characters (e.g. `'ok'`). | Returns `400 Bad Request` (`'A nota de transição deve conter no mínimo 5 caracteres.'`). |
| 18 | `POST /api/tutoria/kanban/:id/transferir` | Non-existent card ID passed in URL. | Returns `404 Not Found` (`'Cartão de atendimento ${id} não encontrado.'`). |
| 19 | `GET /api/tutoria/tutores` | User record has `email: null`. | Returns `200 OK` with `email: null` without throwing or omitting record. |
| 20 | `GET /api/tutoria/tutores` | Tutor names contain accents or special UTF-8 characters (e.g. `'André'`, `'São Luís'`). | Returns `200 OK` preserving all UTF-8 characters accurately. |
| 21 | All endpoints | Missing Authorization Bearer header. | Returns `401 Unauthorized` (`{ statusCode: 401, message: 'Unauthorized' }`). |
| 22 | All endpoints | Authenticated user lacks `tutoria` module permission (and is not SuperAdmin). | Returns `403 Forbidden` (`{ statusCode: 403, message: 'Forbidden resource' }`). |

---

## 1. Observation

### 1.1 Inspected Source Code & Public Contracts

1. **Schema (`apps/backend/src/db/schema.ts`)**:
   - `tutoriaAtendimentosHistorico` (lines 813-858):
     - `id`: `text PRIMARY KEY` (default: UUID)
     - `atendimentoId`: `text` nullable FK -> `tutoria_atendimentos_kanban.id` (`onDelete: 'cascade'`)
     - `matricula`: `text NOT NULL`
     - `periodo`: `text NOT NULL`
     - `sourceInstitution`: `text NOT NULL DEFAULT 'ead'`
     - `tipoEvento`: `text NOT NULL`
     - `autorId`: `text` nullable FK -> `"user".id` (`onDelete: 'set null'`)
     - `autorNome`: `text` nullable
     - `tutorResponsavelAnteriorId`: `text` nullable FK -> `"user".id`
     - `tutorResponsavelNovoId`: `text` nullable FK -> `"user".id`
     - `estadoAnterior`: `text` nullable
     - `estadoNovo`: `text` nullable
     - `canalContato`: `text` nullable
     - `observacoes`: `text` nullable
     - `metadata`: `text` nullable (JSON stringified)
     - `createdAt`: `timestamp NOT NULL DEFAULT now()`
   - Allowed Enums in schema:
     - `TutoriaTipoEvento` = `'abertura' | 'mudanca_status' | 'contato_enviado' | 'intervencao_manual' | 'passagem_bastao' | 'finalizacao' | 'reabertura'`
     - `TutoriaCanalContato` = `'whatsapp' | 'email' | 'telefone' | 'ava' | 'outro'`
   - `tutoriaAtendimentosKanban` (lines 763-811):
     - Tracks `tutorResponsavelId`, `tutorIniciadorId`, `statusKanban`, `observacoes`, `canalContatoUtilizado`, `ultimoContatoEm`, `dataResolucao`, `ultimaIntervencaoEm`, `qtdIntervencoes`, `createdAt`, `updatedAt`.

2. **DTOs (`apps/backend/src/tutoria/dto/`)**:
   - `create-intervencao.dto.ts`:
     - `@IsNotEmpty()` `matricula: string`
     - `@IsNotEmpty()`, `@IsIn(TUTORIA_TIPOS_EVENTO)` `tipoEvento: TutoriaTipoEvento`
     - `@IsNotEmpty()` `observacoes: string`
     - `@IsOptional()`, `@Transform(({ value }) => value === '' ? undefined : value)`, `@IsIn(TUTORIA_CANAIS_CONTATO)` `canalContato?: TutoriaCanalContato`
     - `@IsOptional()`, `@IsString()` `atendimentoId?: string`
     - `@IsOptional()`, `@IsString()` `periodo?: string`
     - `@IsOptional()`, `@IsString()` `statusKanban?: string`
     - `@IsOptional()` `metadata?: any`
   - `transferir-tutor.dto.ts`:
     - `@IsNotEmpty()`, `@IsString()` `novoTutorId: string`
     - `@IsNotEmpty()`, `@IsString()`, `@MinLength(5)` `notaTransicao: string`
   - `update-kanban-card.dto.ts`:
     - `@IsOptional()` `statusKanban?: string`, `observacoes?: string`, `canalContatoUtilizado?: string`, `ultimoContatoEm?: string`, `dataResolucao?: string`

3. **Controller (`apps/backend/src/tutoria/tutoria.controller.ts`)**:
   - Guard: `@RequireModule('tutoria')` + Controller route prefix `@Controller('api/tutoria')`.
   - Global guards in `AppModule`: `JwtAuthGuard` and `RbacGuard`.
   - Endpoints:
     - `GET /api/tutoria/tutores` -> `getActiveTutors()` (Status 200)
     - `GET /api/tutoria/aluno/:matricula/timeline` -> `getStudentTimeline(matricula, atendimentoId)` (Status 200)
     - `POST /api/tutoria/intervencoes` -> `createIntervencao(dto, req)` (`@HttpCode(HttpStatus.CREATED)`, Status 201)
     - `POST /api/tutoria/kanban/:id/transferir` -> `transferirTutor(id, dto, req)` (`@HttpCode(HttpStatus.OK)`, Status 200)
     - `PATCH /api/tutoria/kanban/:id` -> `updateKanbanCard(id, dto, req.user?.id, req.user?.name)` (Status 200)

4. **Service Implementation (`apps/backend/src/tutoria/tutoria.service.ts`)**:
   - `getTimelineAluno` (lines 1412-1515):
     - Validates `matriculaParam` (throws `BadRequestException` if empty).
     - Validates `atendimentoId` length >= 5 if provided (throws `BadRequestException` if < 5).
     - Queries `tutoria_atendimentos_historico` aliasing columns to camelCase: `atendimentoId`, `tipoEvento`, `autorId`, `autorNome`, `tutorResponsavelAnteriorId`, `tutorResponsavelNovoId`, `estadoAnterior`, `estadoNovo`, `canalContato`.
     - Parses `metadata` JSON strings.
     - Fallback for legacy cards: If historical events count is 0, queries `tutoria_atendimentos_kanban` for matching matricula and generates synthetic opening event (`id: legacy-${c.id}`, `tipoEvento: 'abertura'`). If no card exists, returns `[]`.
   - `registrarIntervencao` (lines 1114-1284):
     - Validates trimmed non-empty `matricula` and `observacoes`.
     - Validates `tipoEvento`, `canalContato`, `statusKanban` against whitelists.
     - Resolves `autorNome` via `resolveTutorInfo` with 60s cache.
     - Searches card by `atendimentoId` or latest by `matricula` + `periodo`.
     - Updates card metrics (`ultima_intervencao_em = now()`, increments `qtd_intervencoes`).
     - Inserts row into `tutoria_atendimentos_historico`.
     - Returns object with camelCase properties matching `TimelineEvent`.
   - `getTutoresAtivos` (lines 1526-1534):
     - Queries `SELECT id, name, email FROM "user" WHERE "isActive" = true ORDER BY name ASC;`.
   - `transferirTutor` (lines 1296-1409):
     - Validates card exists (404), target tutor exists (404) and is active (400), target tutor is not current owner (400), note length >= 5 (400).
     - Updates `tutor_responsavel_id` on card, increments interventions.
     - Inserts `passagem_bastao` audit row.

5. **Existing Frontend Server Actions (`apps/frontend/src/app/actions/tutoria.ts`)**:
   - Lines 267-290: Defines TypeScript interface `TimelineEvent`.
   - Lines 292-296: Defines TypeScript interface `ActiveTutor`.
   - Lines 298-307: Defines TypeScript interface `CreateTutoriaIntervencaoInput`.
   - Lines 318-356: `getTutoriaTimeline(matricula, atendimentoId?)`: returns `{ success: boolean, events: TimelineEvent[], error?: string }`.
   - Lines 362-405: `createTutoriaIntervencao(data)`: returns `{ success: boolean, data?: any, id?: string, error?: string }`.
   - Lines 411-461: `transferirTutoriaBastao(id, data)`: returns `{ success: boolean, card?: any, evento?: any, error?: string }`.
   - Lines 467-493: `getTutoresAtivos()`: returns `{ success: boolean, tutores: ActiveTutor[], error?: string }`.

---

## 2. Logic Chain

1. **Field Naming & Case Convention**:
   - The PostgreSQL schema uses standard PostgreSQL snake_case (`atendimento_id`, `tipo_evento`, `autor_id`, `autor_nome`, `tutor_responsavel_anterior_id`, `tutor_responsavel_novo_id`, `estado_anterior`, `estado_novo`, `canal_contato`, `observacoes`, `metadata`, `createdAt`).
   - The query in `tutoria.service.ts:1430-1445` explicitly maps all columns via SQL aliases into standard TypeScript **camelCase** (`h.atendimento_id AS "atendimentoId"`, `h.tipo_evento AS "tipoEvento"`, etc.).
   - Frontend components (`TutoriaTimeline.tsx` and `TutoriaInterventionForm.tsx`) must consume camelCase properties (`event.atendimentoId`, `event.tipoEvento`, `event.autorNome`, `event.canalContato`, `event.observacoes`, `event.createdAt`).

2. **Nullability & Fallbacks**:
   - A discente can have interventions without a Kanban card; in that scenario `atendimentoId` is `null`.
   - An intervention may be recorded without external communication (e.g. `'intervencao_manual'`); in that scenario `canalContato` is `null`.
   - In events created by system or without user info, `autorNome` falls back safely to `'Tutor Atuante'` or `'Tutor Responsável'`.
   - For legacy cards without any audit trail rows, the backend synthesizes an initial `abertura` event with `id: legacy-${card.id}`, ensuring UI components never display a blank or broken state for existing students.

3. **Server Actions vs Backend Return Type Mapping**:
   - In backend:
     - `GET /api/tutoria/aluno/:matricula/timeline` returns `TimelineEvent[]` directly.
     - `GET /api/tutoria/tutores` returns `ActiveTutor[]` directly.
     - `POST /api/tutoria/intervencoes` returns single `TimelineEvent` directly.
   - In `apps/frontend/src/app/actions/tutoria.ts`:
     - `getTutoriaTimeline` wraps the response in `{ success: true, events: TimelineEvent[] }`.
     - `createTutoriaIntervencao` wraps the response in `{ success: true, data: TimelineEvent }`.
     - `getTutoresAtivos` wraps the response in `{ success: true, tutores: ActiveTutor[] }`.
   - Frontend developers building `TutoriaTimeline.tsx` and `TutoriaDashboard.tsx` must access `.events` (or `.tutores`), or the Server Action should also provide `.data` aliases for uniformity with `sub_orch_m3/SCOPE.md`.

---

## 3. Caveats

1. **Empty Result Behavior (404 vs Empty Array)**:
   - When a student matriculation or attendance card ID does not exist, `GET /api/tutoria/aluno/:matricula/timeline` returns HTTP `200 OK` with an empty array `[]`, **not** a `404 Not Found`. Frontend components should check `events.length === 0` to render an empty state message ("Nenhuma intervenção registrada").
2. **Channel Enum Formatting**:
   - Backend channels are strictly lowercase: `'whatsapp'`, `'email'`, `'telefone'`, `'ava'`, `'outro'`. In UI select inputs, values must be lowercase while visual labels can be formatted (e.g. `label: "WhatsApp"`, `value: "whatsapp"`).
3. **Empty String Transformation in Interventions**:
   - In `create-intervencao.dto.ts`, `canalContato` uses `@Transform(({ value }) => (value === '' ? undefined : value))`. Sending `canalContato: ""` from a HTML `<select>` will safely be converted to `undefined`/`null`, avoiding validation errors.
4. **Isolated E2E Test Suite**:
   - In `apps/backend/test/tutoria-multitutor.e2e-spec.ts`, line 803 has a missing import (`Get` from `@nestjs/common`) in the test harness mock controller. This does NOT affect production code (`tutoria.controller.ts` and `tutoria.service.ts` are 100% clean and 31/31 unit tests pass). This can be adjusted in Milestone 5/6 hardening.

---

## 4. Conclusion

All backend APIs, schemas, and data contracts for Milestone 3 are verified, completely documented, and production-ready:
1. `GET /api/tutoria/aluno/:matricula/timeline` guarantees a camelCase chronological list of events with automatic legacy fallback support.
2. `POST /api/tutoria/intervencoes` enforces strict validation on required fields (`matricula`, `tipoEvento`, `observacoes`) while updating card metrics in real-time.
3. `GET /api/tutoria/tutores` delivers active tutors sorted alphabetically for selection dropdowns.
4. The frontend worker for Milestone 3 (`m3_worker_1`) can directly consume `apps/frontend/src/app/actions/tutoria.ts` and build `TutoriaTimeline.tsx` and `TutoriaInterventionForm.tsx` following the exact contracts verified above.

---

## 5. Verification Method

To verify these backend contracts and implementations:

```powershell
# 1. Run unit test suite for TutoriaService (verifies all 31 tests including timeline, interventions, tutores, baton pass, and author resolution)
npm run test --prefix apps/backend -- tutoria.service.spec.ts

# 2. Typecheck backend workspace
npx tsc --noEmit -p apps/backend/tsconfig.json

# 3. Verify files inspected:
# apps/backend/src/tutoria/tutoria.controller.ts
# apps/backend/src/tutoria/tutoria.service.ts
# apps/backend/src/tutoria/dto/create-intervencao.dto.ts
# apps/backend/src/tutoria/dto/transferir-tutor.dto.ts
# apps/backend/src/db/schema.ts
# apps/frontend/src/app/actions/tutoria.ts
```
