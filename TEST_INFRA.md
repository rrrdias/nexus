# TEST_INFRA.md — E2E Test Infrastructure Specification

**Project**: Multi-Tutor Hybrid Attendance, Timeline & Audit Trail (NexusHub Tutoria)  
**Track**: E2E Testing Track  
**Milestone**: E1 (Test Infra & Specification)  
**Status**: APPROVED & PUBLISHED  
**Version**: 1.0.0  
**Updated**: 2026-11-10T20:40:00Z  

---

## 1. Overview & Test Philosophy

This document defines the comprehensive end-to-end (E2E) and integration test infrastructure for the Multi-Tutor Hybrid Attendance, Timeline, and Audit Trail subsystem of NexusHub.

### Core Principles
1. **Opaque-Box Requirement-Driven Testing**: Tests are formulated strictly against business requirements (R1 to R4 in `ORIGINAL_REQUEST.md`) and interface contracts in `PROJECT.md`, without relying on implementation-internal private methods.
2. **Zero External Dependency Flakiness**: The test harnesses are strictly isolated from volatile network infrastructure. Neither live Redis (`127.0.0.1:6379`) nor remote Lyceum MSSQL Server (`172.29.44.90:1433`) is required. Test runs boot in <300ms, run deterministically in CI/CD, and never hang.
3. **Multi-Persona Security Verification**: Tests validate the entire authentication and RBAC pipeline using signed JWT tokens across multiple personas:
   - Primary Lead Tutor (`Tutor A`)
   - Collaborator Tutor (`Tutor B`)
   - Successor Tutor (`Tutor C`)
   - Super Administrator (`Admin`)
   - Unauthorized / Cross-Role User (`Student`)
4. **4-Tier Depth**: Verification spans Category-Partition feature coverage, Boundary Value Analysis, Cross-Feature Combinations, and Real-World multi-tutor pedagogical workflows.

---

## 2. Directory Layout & File Inventory

```text
nexus-core/
├── TEST_INFRA.md                                  # This master infrastructure specification
├── TEST_READY.md                                  # Published completion signal after E6 verification
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── schema.ts                     # Drizzle schema (tutoriaAtendimentosHistorico, etc.)
│   │   │   │   └── migrate-tutoria-multitutor.ts # Idempotent migration script
│   │   │   └── tutoria/
│   │   │       ├── dto/
│   │   │       │   ├── create-intervencao.dto.ts # DTO for manual/communication interventions
│   │   │       │   ├── transferir-tutor.dto.ts   # DTO for baton pass with transition notes
│   │   │       │   └── update-kanban-card.dto.ts # DTO for card updates
│   │   │       ├── tutoria.controller.ts         # Multi-tutor endpoints
│   │   │       ├── tutoria.service.ts            # Business logic & audit event logger
│   │   │       └── tutoria.service.spec.ts       # Backend unit tests
│   │   └── test/
│   │       ├── jest-e2e.json                     # Jest E2E configuration
│   │       └── tutoria-multitutor.e2e-spec.ts    # Isolated backend E2E harness (Tiers 1-4)
│   └── frontend/
│       └── src/
│           ├── app/
│           │   └── actions/
│           │       ├── api.ts                    # fetchFromApi wrapper (with TEST_AUTH_TOKEN support)
│           │       └── tutoria.ts                # Server Actions (timeline, baton pass, interventions)
│           ├── components/
│           │   └── tutoria/
│           │       ├── BatonPassDialog.tsx       # Transfer modal with mandatory transition note
│           │       ├── TutoriaInterventionForm.tsx# Quick intervention logging form
│           │       └── TutoriaTimeline.tsx       # Chronological timeline visualization
│           └── lib/
│               ├── tutoria-utils.ts              # Timeline formatting, badge colors, baton validation
│               └── tutoria-e2e.test.ts           # Standalone frontend E2E runner (via npx tsx)
```

---

## 3. Test Harness Architecture

### 3.1 Backend Isolated E2E Harness (`apps/backend/test/tutoria-multitutor.e2e-spec.ts`)

#### Problem Statement
Existing test files in `apps/backend/test/*.e2e-spec.ts` import the monolithic `AppModule`. `AppModule` automatically boots BullMQ workers (`JobsModule`) that attempt connections to `127.0.0.1:6379` (Redis) and `AcademicModule` that connects to `172.29.44.90:1433` (Lyceum MSSQL). In environments without these live databases, tests fail with `connect EACCES` and hang indefinitely during `afterAll(await app.close())`.

#### Architectural Solution
`tutoria-multitutor.e2e-spec.ts` constructs an isolated `TestingModule` that mounts `TutoriaController` and `TutoriaService` directly, alongside the security providers (`JwtModule`, `JwtAuthGuard`, `RbacGuard`), while completely eliminating `BullModule` and `AcademicModule`.

```typescript
// Architectural Blueprint: apps/backend/test/tutoria-multitutor.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { TutoriaController } from '../src/tutoria/tutoria.controller';
import { TutoriaService } from '../src/tutoria/tutoria.service';
import { TutoriaSyncService } from '../src/tutoria/tutoria-sync.service';
import { DB_CONNECTION } from '../src/db/db.provider';
import { CacheService } from '../src/cache/cache.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RbacGuard } from '../src/auth/rbac.guard';

// 1. Stateful In-Memory Mock Database Router
// Accurately tracks kanban cards and timeline history records across sequential operations
const mockDb = {
  _state: {
    kanbanCards: new Map<string, any>(),
    timelineEvents: new Array<any>(),
    users: new Map<string, any>([
      ['tutor-lead-1', { id: 'tutor-lead-1', name: 'Prof. Carlos Titular', email: 'carlos@unievangelica.edu.br', isActive: true, isSuperAdmin: false }],
      ['tutor-collab-2', { id: 'tutor-collab-2', name: 'Profa. Marina Colaboradora', email: 'marina@unievangelica.edu.br', isActive: true, isSuperAdmin: false }],
      ['tutor-new-3', { id: 'tutor-new-3', name: 'Prof. Roberto Sucessor', email: 'roberto@unievangelica.edu.br', isActive: true, isSuperAdmin: false }],
      ['admin-master', { id: 'admin-master', name: 'Admin Master', email: 'admin@unievangelica.edu.br', isActive: true, isSuperAdmin: true }],
      ['student-unauth', { id: 'student-unauth', name: 'Aluno Sem Acesso', email: 'aluno@unievangelica.edu.br', isActive: true, isSuperAdmin: false }],
    ]),
  },
  execute: jest.fn().mockImplementation(async (query: any) => {
    // Router resolves DDL, active tutors query, kanban card queries, and timeline audit trail queries
    return [];
  }),
  select: jest.fn().mockImplementation(() => createFluentChain()),
  insert: jest.fn().mockImplementation(() => createFluentChain()),
  update: jest.fn().mockImplementation(() => createFluentChain()),
  delete: jest.fn().mockImplementation(() => createFluentChain()),
};
```

#### Key Capabilities
- **Fast Execution**: Executes in <500ms with `--runInBand --forceExit`.
- **Full HTTP Security**: Tests live HTTP requests with Supertest against `JwtAuthGuard` and `RbacGuard`.
- **Hybrid Multi-Tutor State Verification**: Validates that collaborator updates modify card metadata/status without overwriting `tutorResponsavelId`.
- **Audit Trail Persistence**: Verifies that every action appends an immutable row to `tutoria_atendimentos_historico`.

---

### 3.2 Frontend Standalone E2E Harness (`apps/frontend/src/lib/tutoria-e2e.test.ts`)

#### Problem Statement
In Next.js 16 / React 19, Server Actions (`apps/frontend/src/app/actions/tutoria.ts`) call `fetchFromApi` in `apps/frontend/src/app/actions/api.ts`. `fetchFromApi` calls `auth()` from `next-auth`, which invokes Next.js `headers()`. When run in pure Node.js (via `tsx`), calling `headers()` throws:
`headers was called outside a request scope`.

#### Architectural Solution
1. **Server Actions Test Hook**: In `apps/frontend/src/app/actions/api.ts`, add support for test authentication:
   ```typescript
   export async function fetchFromApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
     // If running in test mode with TEST_AUTH_TOKEN, bypass Next.js headers()
     let token: string | undefined = process.env.TEST_AUTH_TOKEN;
     if (!token) {
       const session = await auth();
       token = session?.user?.accessToken;
       if (!token) {
         await signOut({ redirectTo: "/nexus/login" });
       }
     }
     // Proceed with fetch...
   ```
2. **Global Fetch Interceptor**: In `apps/frontend/src/lib/tutoria-e2e.test.ts`, install a mock `globalThis.fetch` handler that:
   - Captures request URL, HTTP method, query strings, headers (`Authorization: Bearer ...`), and parsed JSON body.
   - Emulates backend responses (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Error).
   - Validates that Server Actions return safe fallback objects without throwing unhandled exceptions to UI components.
3. **Pure Presentation & Data Utilities**: Verifies timeline chronological sorting, calendar grouping (`Hoje`, `Ontem`, `DD/MM/YYYY`), author badges (`Você (Tutor Responsável)` vs `Colaborador`), channel icons, and baton pass validation rules.

---

## 4. Comprehensive 4-Tier Test Matrix

The test catalog specifies 93 test cases across 8 features (F1 through F8).

### 4.1 Feature Mapping (Features Under Test)
| # | Feature | Business Requirement | Description |
|---|---|---|---|
| 1 | **F1: Modelo Híbrido Multi-Tutor** | R1 | Primary lead tutor retention; collaborative interventions without ownership hijacking |
| 2 | **F2: Trilha de Auditoria Schema** | R2 | Persistent audit table `tutoria_atendimentos_historico` with author, types, and states |
| 3 | **F3: Auditoria de Mudanças Kanban** | R2 | Automatic audit event generation on column transitions with acting author |
| 4 | **F4: Registro de Comunicação** | R2 | Multi-channel communication tracking (WhatsApp, Email, Telefone, AVA) |
| 5 | **F5: Passagem de Bastão** | R2, R3 | Explicit ownership transfer (`POST /api/tutoria/kanban/:id/transferir`) with mandatory note |
| 6 | **F6: Linha do Tempo Consolidada** | R3 | Consolidated chronological timeline endpoint (`GET /api/tutoria/aluno/:matricula/timeline`) |
| 7 | **F7: API de Tutores Ativos** | R3 | Active tutors roster endpoint (`GET /api/tutoria/tutores`) for dropdowns |
| 8 | **F8: Validação de Ações Frontend**| R4 | Server Actions, payload construction, response parsing, error handling in `actions/tutoria.ts` |

---

### 4.2 Tier 1: Feature Coverage (Category-Partition Happy Paths)
*Minimum 5 test cases per feature (Total: 40 test cases).*

| Test ID | Feature | Description | HTTP Method & Path | Expected Status | Primary Invariant |
|---|---|---|---|---|---|
| `TC-T1-F1-01` | F1 | Collaborator updates notes on card owned by Lead Tutor | `PATCH /api/tutoria/kanban/:id` | 200 OK | `card.tutorResponsavelId` unchanged |
| `TC-T1-F1-02` | F1 | Collaborator moves card status column | `PATCH /api/tutoria/kanban/:id` | 200 OK | Status updated; ownership unchanged |
| `TC-T1-F1-03` | F1 | Collaborator logs WhatsApp outreach | `POST /api/tutoria/intervencoes` | 201 Created | Card contact time updated; owner unchanged |
| `TC-T1-F1-04` | F1 | Creation of attendance card with primary tutor | `POST /api/tutoria/kanban` | 201 Created | `tutorResponsavelId` initialized |
| `TC-T1-F1-05` | F1 | Primary Lead Tutor updates card directly | `PATCH /api/tutoria/kanban/:id` | 200 OK | Lead tutor updates notes |
| `TC-T1-F2-01` | F2 | Audit event persistence for card opening (`abertura`) | `POST /api/tutoria/kanban` | 201 Created | Row in `tutoria_atendimentos_historico` |
| `TC-T1-F2-02` | F2 | Audit event for status transition (`mudanca_status`) | `PATCH /api/tutoria/kanban/:id` | 200 OK | `estadoAnterior` and `estadoNovo` recorded |
| `TC-T1-F2-03` | F2 | Audit event for communication sent (`contato_enviado`) | `POST /api/tutoria/intervencoes` | 201 Created | `canalContato` and metadata recorded |
| `TC-T1-F2-04` | F2 | Audit event for manual intervention note | `POST /api/tutoria/intervencoes` | 201 Created | Full observation note recorded |
| `TC-T1-F2-05` | F2 | Audit event for card resolution (`finalizacao`) | `PATCH /api/tutoria/kanban/:id` | 200 OK | `dataResolucao` populated with audit record |
| `TC-T1-F3-01` | F3 | Transition from `pendente` to `em_contato` | `PATCH /api/tutoria/kanban/:id` | 200 OK | Column updated; author logged |
| `TC-T1-F3-02` | F3 | Transition from `em_contato` to `em_recuperacao` | `PATCH /api/tutoria/kanban/:id` | 200 OK | Column updated; author logged |
| `TC-T1-F3-03` | F3 | Transition to `revertido` sets `dataResolucao` | `PATCH /api/tutoria/kanban/:id` | 200 OK | Resolution date populated |
| `TC-T1-F3-04` | F3 | Transition to terminal status `evadido` | `PATCH /api/tutoria/kanban/:id` | 200 OK | Terminal status recorded |
| `TC-T1-F3-05` | F3 | Regress card from `aguardando_retorno` to `em_contato` | `PATCH /api/tutoria/kanban/:id` | 200 OK | Status regressed with explanation |
| `TC-T1-F4-01` | F4 | Log WhatsApp communication | `POST /api/tutoria/intervencoes` | 201 Created | Channel: `whatsapp` |
| `TC-T1-F4-02` | F4 | Log Email communication with subject metadata | `POST /api/tutoria/intervencoes` | 201 Created | Channel: `email`, metadata persisted |
| `TC-T1-F4-03` | F4 | Log Phone call attempt and result | `POST /api/tutoria/intervencoes` | 201 Created | Channel: `telefone` |
| `TC-T1-F4-04` | F4 | Log AVA LMS internal message | `POST /api/tutoria/intervencoes` | 201 Created | Channel: `ava` |
| `TC-T1-F4-05` | F4 | Update channel and contact timestamp via card PATCH | `PATCH /api/tutoria/kanban/:id` | 200 OK | `ultimoContatoEm` updated |
| `TC-T1-F5-01` | F5 | Lead Tutor transfers ownership to Tutor B | `POST /api/tutoria/kanban/:id/transferir` | 200 OK | `tutorResponsavelId` mutates to Tutor B |
| `TC-T1-F5-02` | F5 | Admin rebalances card ownership | `POST /api/tutoria/kanban/:id/transferir` | 200 OK | Admin transfers card |
| `TC-T1-F5-03` | F5 | Assign initial ownership to unassigned card | `POST /api/tutoria/kanban/:id/transferir` | 200 OK | `tutorResponsavelAnteriorId` is null |
| `TC-T1-F5-04` | F5 | Baton pass with pedagogical transition context | `POST /api/tutoria/kanban/:id/transferir` | 200 OK | Transition note saved in audit row |
| `TC-T1-F5-05` | F5 | Baton pass endpoint standardized response schema | `POST /api/tutoria/kanban/:id/transferir` | 200 OK | Returns `{ success: true, card, evento }` |
| `TC-T1-F6-01` | F6 | Query full student timeline | `GET /api/tutoria/aluno/:matricula/timeline` | 200 OK | Chronological array of all events |
| `TC-T1-F6-02` | F6 | Query student timeline filtered by attendance card ID | `GET /api/tutoria/aluno/:matricula/timeline?atendimentoId=...` | 200 OK | Strictly scoped to attendance ID |
| `TC-T1-F6-03` | F6 | Timeline reflects multiple distinct authors with names | `GET /api/tutoria/aluno/:matricula/timeline` | 200 OK | Author names denormalized |
| `TC-T1-F6-04` | F6 | Timeline with single opening event | `GET /api/tutoria/aluno/:matricula/timeline` | 200 OK | Single event array returned |
| `TC-T1-F6-05` | F6 | Timeline attributes snapshot completeness | `GET /api/tutoria/aluno/:matricula/timeline` | 200 OK | All contract properties present |
| `TC-T1-F7-01` | F7 | Authenticated tutor fetches active tutors list | `GET /api/tutoria/tutores` | 200 OK | Returns array of active tutors |
| `TC-T1-F7-02` | F7 | Authenticated administrator fetches active tutors list | `GET /api/tutoria/tutores` | 200 OK | Returns array of active tutors |
| `TC-T1-F7-03` | F7 | Active tutors contract returns id, name, email | `GET /api/tutoria/tutores` | 200 OK | Objects conform to schema |
| `TC-T1-F7-04` | F7 | Active tutors list excludes inactive/disabled users | `GET /api/tutoria/tutores` | 200 OK | Inactive tutors filtered out |
| `TC-T1-F7-05` | F7 | Active tutors list sorted alphabetically | `GET /api/tutoria/tutores` | 200 OK | Sorted by name ascending |
| `TC-T1-F8-01` | F8 | Server action `getTutoriaTimeline` parses response | Action invocation | Success | Returns typed `{ success: true, events }` |
| `TC-T1-F8-02` | F8 | Server action `createTutoriaIntervencao` valid payload | Action invocation | Success | Builds correct JSON payload |
| `TC-T1-F8-03` | F8 | Server action `transferirTutoriaBastao` execution | Action invocation | Success | Calls transfer endpoint |
| `TC-T1-F8-04` | F8 | Server action `getTutoresAtivos` returns roster | Action invocation | Success | Returns tutor list for UI dropdown |
| `TC-T1-F8-05` | F8 | Server action `updateTutoriaKanbanCard` updates card | Action invocation | Success | Calls PATCH endpoint |

---

### 4.3 Tier 2: Boundary & Corner Cases (Boundary Value Analysis)
*Minimum 5 test cases per feature (Total: 40 test cases).*

| Test ID | Feature | Description | Boundary Condition | Expected Outcome |
|---|---|---|---|---|
| `TC-T2-F1-01` | F1 | Collaborator injects `tutorResponsavelId` in PATCH | Parameter tampering | Overwrite ignored; owner remains Tutor A |
| `TC-T2-F1-02` | F1 | Unauthenticated user attempts update | Missing JWT token | 401 Unauthorized |
| `TC-T2-F1-03` | F1 | User without tutoria module permission | RBAC restriction | 403 Forbidden |
| `TC-T2-F1-04` | F1 | Collaborator updates card with null initial owner | Null boundary | Owner remains null; explicit pass needed |
| `TC-T2-F1-05` | F1 | Update non-existent card UUID | Entity not found | 404 Not Found |
| `TC-T2-F2-01` | F2 | Audit event with invalid `tipoEvento` enum value | Schema validation | 400 Bad Request |
| `TC-T2-F2-02` | F2 | Pedagogical note at upper length limit (5,000 chars) | Max string boundary | 201 Created; stored without truncation |
| `TC-T2-F2-03` | F2 | Optional fields set explicitly to `null` | Nullable attributes | 201 Created; clean null persistence |
| `TC-T2-F2-04` | F2 | Complex nested JSON in `metadata` attribute | Structured JSON | 201 Created; JSON preserved intact |
| `TC-T2-F2-05` | F2 | Empty or whitespace-only `matricula` | Required string | 400 Bad Request |
| `TC-T2-F3-01` | F3 | Transition to invalid Kanban column status | Invalid enum | 400 Bad Request |
| `TC-T2-F3-02` | F3 | Idempotent transition to same status | No-op transition | 200 OK; redundant audit event skipped |
| `TC-T2-F3-03` | F3 | Status update with empty string note (`observacoes: ""`) | Empty string | 200 OK; handled safely without crash |
| `TC-T2-F3-04` | F3 | Acting tutor user record has null name | User profile edge | 200 OK; fallback author name applied |
| `TC-T2-F3-05` | F3 | Status update with whitespace-only note | Whitespace trimming | 200 OK; whitespace trimmed cleanly |
| `TC-T2-F4-01` | F4 | Communication record with unsupported channel | Invalid channel | 400 Bad Request |
| `TC-T2-F4-02` | F4 | Communication record with empty `observacoes` | Mandatory field | 400 Bad Request |
| `TC-T2-F4-03` | F4 | Communication record with whitespace-only `observacoes` | Whitespace validation | 400 Bad Request |
| `TC-T2-F4-04` | F4 | Matricula with leading/trailing spaces | Input sanitization | 201 Created; matricula trimmed |
| `TC-T2-F4-05` | F4 | Missing `tipoEvento` in payload | Missing required key | 400 Bad Request |
| `TC-T2-F5-01` | F5 | Baton pass targeting non-existent `novoTutorId` | Foreign key validity | 400 Bad Request or 404 Not Found |
| `TC-T2-F5-02` | F5 | Malformed UUID for `novoTutorId` | Format validation | 400 Bad Request |
| `TC-T2-F5-03` | F5 | Baton pass with empty `notaTransicao` | Mandatory note | 400 Bad Request |
| `TC-T2-F5-04` | F5 | Baton pass with whitespace-only `notaTransicao` | Whitespace validation | 400 Bad Request |
| `TC-T2-F5-05` | F5 | Transfer targeting current owner (`novoTutor == current`) | Self-transfer rejection | 400 Bad Request ("Já atribuído") |
| `TC-T2-F6-01` | F6 | Query timeline for non-existent student | Empty collection | 200 OK; returns empty array `[]` |
| `TC-T2-F6-02` | F6 | SQL injection attempt in matricula parameter | Security sanitization | Handled safely; returns `[]` or 400 |
| `TC-T2-F6-03` | F6 | Non-existent `atendimentoId` query filter | Filter edge case | 200 OK; returns empty array `[]` |
| `TC-T2-F6-04` | F6 | Malformed UUID in `atendimentoId` query filter | Format validation | 400 Bad Request |
| `TC-T2-F6-05` | F6 | Unauthenticated query to timeline endpoint | Security check | 401 Unauthorized |
| `TC-T2-F7-01` | F7 | Unauthenticated query to `GET /api/tutoria/tutores` | Security check | 401 Unauthorized |
| `TC-T2-F7-02` | F7 | Query by user role lacking tutoria permission | RBAC check | 403 Forbidden |
| `TC-T2-F7-03` | F7 | Database returns zero active tutors | Empty table | 200 OK; returns empty array `[]` |
| `TC-T2-F7-04` | F7 | Active tutor record has null or missing email | Profile edge case | 200 OK; handles null email gracefully |
| `TC-T2-F7-05` | F7 | Active tutor name with special characters/accents | UTF-8 encoding | 200 OK; proper encoding preserved |
| `TC-T2-F8-01` | F8 | Action `createTutoriaIntervencao` with empty notes | Client validation | Rejects before network call |
| `TC-T2-F8-02` | F8 | Action `transferirTutoriaBastao` with whitespace note | Client validation | Rejects before network call |
| `TC-T2-F8-03` | F8 | Action `getTutoriaTimeline` on backend 500 | Error resilience | Returns `{ success: false, events: [] }` |
| `TC-T2-F8-04` | F8 | Action `updateTutoriaKanbanCard` on 404 | Error resilience | Returns `{ success: false, error: "..." }` |
| `TC-T2-F8-05` | F8 | Action `getTutoresAtivos` on network failure | Fault tolerance | Returns `{ success: false, tutores: [] }` |

---

### 4.4 Tier 3: Cross-Feature Interactions & Combinations (Pairwise & Sequential Flows)
*8 comprehensive interaction tests.*

| Test ID | Sequence & Combination | Features Tested | Invariants & Assertions |
|---|---|---|---|
| `TC-T3-INT-01` | Collaborator intervention followed by Lead Tutor status change | F1 + F2 + F3 + F4 | Card owner stays Tutor A; timeline shows 3 ordered events with distinct authors |
| `TC-T3-INT-02` | Collaborator moves card, then Lead Tutor passes baton to Collaborator | F1 + F3 + F5 + F6 | Collaborator move preserves owner; baton pass cleanly mutates owner to Tutor B |
| `TC-T3-INT-03` | Baton pass followed by intervention from former lead tutor | F1 + F4 + F5 + F6 | Former owner actions do NOT recapture ownership; owner stays Tutor B |
| `TC-T3-INT-04` | Chained rapid status moves by multiple distinct collaborators | F1 + F3 + F6 | Owner unchanged; timeline retains complete chronological audit path |
| `TC-T3-INT-05` | Chained multi-hop baton pass (Tutor A -> Tutor B -> Tutor C) | F5 + F6 + F7 | Final owner is Tutor C; both transition notes and prior owners preserved |
| `TC-T3-INT-06` | Card resolution (`revertido`) following multi-channel outreach | F2 + F3 + F4 + F6 | Timeline shows WhatsApp, Email, Phone logs prior to final resolution event |
| `TC-T3-INT-07` | Intervention logging with concurrent status update in single request | F3 + F4 + F6 | Card status updated; timeline records intervention linked to acting author |
| `TC-T3-INT-08` | Timeline query scoping: Global student history vs card-specific | F2 + F6 | Global query returns all historic cards; filtered query scopes to single card |

---

### 4.5 Tier 4: Real-World Multi-Tutor Workload Scenarios
*5 realistic end-to-end pedagogical workflows.*

1. **`TC-T4-SCN-01` — Critical Dropout Prevention Outreach Journey**:
   - Discente inactive for 35 days. Lead Tutor A opens card (`pendente`).
   - Night-shift Collaborator Tutor B logs urgent WhatsApp contact and moves card to `em_contato`.
   - Discente responds; Tutor B logs response note.
   - Lead Tutor A negotiates deadline extension with professor and moves card to `em_recuperacao`.
   - Discente submits AP1; Tutor A marks card as `revertido`.
   - *Invariant*: `tutorResponsavelId` remains Tutor A; timeline contains 5 alternating-author audit events.

2. **`TC-T4-SCN-02` — Shift Handover and Baton Pass**:
   - Day shift Tutor A reaches shift end; queries `GET /api/tutoria/tutores` to locate night shift Tutor B.
   - Tutor A executes baton pass with pedagogical handover note.
   - Night shift Tutor B logs in, verifies case, and submits recovery exam confirmation in AVA.
   - *Invariant*: `tutorResponsavelId` transferred to Tutor B; handover note highlighted in audit trail.

3. **`TC-T4-SCN-03` — Collaborative Multi-Disciplinary Recovery**:
   - Academic Counselor (Tutor A) creates card.
   - Technical Lab Mentor (Tutor C) reviews coding assignment and logs asynchronous code correction.
   - Tutor A conducts phone study counseling session.
   - Tutor C transitions card to `em_recuperacao`.
   - *Invariant*: Neither of Tutor C's actions overwrites Tutor A's ownership; timeline displays multi-disciplinary participation.

4. **`TC-T4-SCN-04` — Term Re-Enrollment and Reopening of Evaded Case**:
   - Student marked as `evadido` in 2026-1 under former Tutor X re-enrolls in 2026-2.
   - New Tutor D reopens card (`em_contato`) and transfers ownership to self with explanatory note.
   - *Invariant*: Timeline preserves complete historical continuity across both academic terms.

5. **`TC-T4-SCN-05` — High-Concurrency Multi-Tutor Action Resilience**:
   - Lead Tutor A and Collaborator Tutor B submit concurrent interventions on the same student card within milliseconds.
   - *Invariant*: Both events are persisted with unique UUIDs and precise microsecond timestamps; no data loss or corruption.

---

## 5. Execution Commands & Verification Guide

### 5.1 Backend Isolated E2E Test Suite
From monorepo root:
```powershell
npm run test:e2e --workspace=@nexus-core/backend -- tutoria-multitutor.e2e-spec.ts
```
Or directly within `apps/backend`:
```powershell
npx jest --config ./test/jest-e2e.json tutoria-multitutor.e2e-spec.ts --runInBand --forceExit
```
*Expected Result*: All backend test cases pass with exit code 0 in <500ms.

### 5.2 Frontend Standalone E2E Test Suite
From monorepo root:
```powershell
npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts
```
Or with explicit tsconfig:
```powershell
npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-e2e.test.ts
```
*Expected Result*: All frontend assertions pass with exit code 0 in <1 second.

### 5.3 Monorepo Typecheck & Build Verification
```powershell
# Typecheck
npm --workspace=@nexus-core/backend exec tsc -- --noEmit
npm --workspace=@nexus-core/frontend exec tsc -- --noEmit

# Lint
npm --workspace=@nexus-core/backend run lint
npm --workspace=@nexus-core/frontend run lint

# Build
npm --workspace=@nexus-core/backend run build
npm --workspace=@nexus-core/frontend run build
```

---

## 6. Publication & Sign-off Criteria (for `TEST_READY.md`)

When implementation of Milestone M6 and E2E Track is complete, `TEST_READY.md` must be published at the project root containing:
1. Total test count (minimum 93 tests across Tiers 1-4).
2. Pass rate (100% required).
3. Zero network bypass confirmation (no live Redis or Lyceum required).
4. Dual confirmation from Reviewer and Challenger agents.
