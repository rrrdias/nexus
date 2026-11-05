# Project: Nexus Core Technical Audit, Architectural Analysis & Roadmap

## Architecture
- **Workspace Architecture**: Monorepo managed via Turborepo (`apps/backend` NestJS 11 + `apps/frontend` Next.js 16.2.6 Turbopack).
- **Backend Architecture**:
  - NestJS modular monolith (`AuthModule`, `UsersModule`, `GroupsModule`, `AcademicModule`, `AvaSyncModule`, `AvaReportsModule`, `SchedulingModule`, `AuditModule`, `CacheModule`, `JobsModule`, `HealthModule`).
  - Database: PostgreSQL 16 via Drizzle ORM (`drizzle-orm/node-postgres`), schema under `apps/backend/src/db/schema.ts`.
  - External Data Sources: Moodle AVA (HTTP Deferred SQL via 6 institution endpoints) & Lyceum SQL Server (MSSQL via `tedious` connection pool).
  - Background Queue & Workers: Redis 7 + BullMQ (`academic-sync`, `ava-sync` queues).
- **Frontend Architecture**:
  - Next.js 16.2.6 App Router (`apps/frontend/src/app`) with Turbopack, standalone output, basePath `/nexus`.
  - Authentication: NextAuth.js / Auth.js with JWT session strategy.
  - Public Booking Flow: Stepper Wizard (`apps/frontend/src/app/agendamento/page.tsx`), Local selector, Date/Slot picker, Student confirmation, Voucher printer.
  - Admin Dashboards: `/admin/scheduling`, `/admin/academic`, `/admin/users`, `/admin/groups`, `/admin/reports`.

## Feature Inventory
| # | Feature / Area | Description | Milestone | Source |
|---|---|---|---|---|
| F1 | Route Authorization & RBAC Audit | 100% mapping of backend controllers, `@Public()`, `@RequireModule()`, roles, and missing guards | M1 | Survey Backend |
| F2 | Student Session Isolation & Cookie Security | `nexus_student_session` encryption/HMAC, TTL, entropy, and prevention of third-party student impersonation | M1 | Survey Backend / Frontend |
| F3 | Injection, Headers & Secret Security | SQL injection posture, XSS vectors (voucher `doc.write`), Helmet, CORS, and CSP header hardening | M1 | Survey Backend / Frontend |
| F4 | Booking Concurrency & Pessimistic Locks | 30-min consecutive slot reservation under high load, `FOR UPDATE` lock order, and deadlock elimination | M2 | Survey Backend |
| F5 | Atomic Reschedule & Slot Restoral | Transaction atomicity during reschedule (preventing slot loss), time format normalization (`HH:MM` vs `HH:MM:00`) | M2 | Survey Backend |
| F6 | Database Query & Index Optimization | Missing composite indexes on `opcaos`, `agendamentos_matricula`, `locais`, `relatorios`, and regex join performance | M2 | Survey Backend |
| F7 | AVA Moodle Integration Resilience | HTTP timeout handling without disabling BullMQ retries, error classifications, retry backoffs | M3 | Survey Integrations |
| F8 | Lyceum MSSQL Pool Lifecycle | TCP connection pool resilience, auto-reconnect, lazy initialization, and unhandled connection error crash prevention | M3 | Survey Integrations |
| F9 | Snapshot Consolidation Consistency | Idempotent upsert (`DISTINCT ON`), student withdrawal cleanup, event loop non-blocking streaming, and redundant execution elimination | M3 | Survey Integrations |
| F10 | Next.js 16 Patterns & Server Actions | Structured error handling avoiding opaque digest masking in production, Server vs Client component boundaries | M4 | Survey Frontend |
| F11 | Student Mobile UX & Stepper Resilience | Browser History API integration, mobile touch targets, loading states, error boundaries (`error.tsx`, `loading.tsx`) | M4 | Survey Frontend |
| F12 | Monorepo Test Infrastructure & Cleanup | Fix backend E2E teardown hook timeout, add frontend npm test script, consolidate lockfiles, eliminate lint warnings | M4 | Survey Baseline |
| F13 | Consolidated Audit Report & Roadmap (R5) | Structured categorization (Critical, High, Medium, Low), Impact vs. Effort matrix, actionable code remediation guide | M5 | Synthesis R1-R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Security, Auth & Access Control Audit (R1) | Controllers/routes mapping, student session HMAC/isolation, admin scheduling RBAC, XSS/CSP, rate limiting | Baseline | DONE |
| M2 | Concurrency, Transactions & Booking Performance (R2) | Consecutive slot locking, deadlock prevention, atomic reschedule, slot release format fix, database indexing | M1 | DONE |
| M3 | AVA & Lyceum Integration Resilience (R3) | MSSQL pool lifecycle, AvaSync BullMQ retries, snapshot regex optimization, event loop & memory leak fixes | Baseline | DONE |
| M4 | Code Quality, Frontend Next.js 16 & UX (R4) | Next.js 16 Server Actions error handling, App Router error/loading boundaries, mobile stepper UX, monorepo scripts | Baseline | DONE |
| M5 | Consolidated Audit Report & Prioritized Roadmap (R5) | Synthesis of all findings, severity categorization, Impact-vs-Effort matrix, executive & technical roadmap | M1, M2, M3, M4 | DONE |

## Code Layout
- Backend Source: `apps/backend/src/`
  - Auth: `apps/backend/src/auth/`
  - Scheduling & Booking: `apps/backend/src/scheduling/`
  - Integrations: `apps/backend/src/ava-sync/`, `apps/backend/src/academic/`
  - Reports: `apps/backend/src/ava-reports/`
  - Database & Drizzle: `apps/backend/src/db/`
- Frontend Source: `apps/frontend/src/`
  - App Router: `apps/frontend/src/app/`
  - Public Booking: `apps/frontend/src/app/agendamento/`
  - Admin Scheduling: `apps/frontend/src/app/admin/scheduling/`
  - Server Actions: `apps/frontend/src/app/actions/`
  - Middleware: `apps/frontend/src/middleware.ts`
  - Components: `apps/frontend/src/components/`

## Interface Contracts
### Public Booking Flow ↔ Backend Scheduling
- `GET /scheduling/public/student-status?matricula=...`
  - Requires signed token / verified session header or cookie.
  - Returns student eligibility, enrolled courses requiring exam, and existing booking.
- `POST /scheduling/public/book`
  - Payload: `{ localId, data, horario, matricula, sessionToken, disciplinas: [...] }`
  - Response: `{ success: true, agendamentoId: ..., voucherCode: ... }`
- `POST /scheduling/public/reschedule`
  - Payload: `{ currentAgendamentoId, newLocalId, newData, newHorario, matricula, sessionToken }`
  - Contract: Must be executed in a single atomic database transaction. If slot reservation fails, original slot is strictly preserved.
- `POST /scheduling/public/cancel`
  - Payload: `{ agendamentoId, matricula, sessionToken }`
  - Contract: Restores `vagas_ocupadas = vagas_ocupadas - 1` matching normalized time format (`HH:MM` or `HH:MM:00`).
