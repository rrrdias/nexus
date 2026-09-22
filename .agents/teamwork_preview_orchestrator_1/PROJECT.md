# Project: Nexus Core Modernization & Functional Deep-Dive Audit

## Architecture
- **Monorepo Structure**: npm workspaces with Turbopack (`apps/backend` NestJS 11, `apps/frontend` Next.js 16.2.6 App Router, `packages/*`).
- **Backend Architecture**: NestJS with modular design (`auth`, `users`, `groups`, `academic`, `ava-sync`, `ava-reports`, `scheduling`, `health`, `jobs`, `cache`, `db`).
- **Frontend Architecture**: Next.js 16 with basePath `/nexus`, NextAuth v5 session management, Server Actions and Client Components with Radix UI / Tailwind CSS.
- **Database & Persistence**: PostgreSQL 16 managed via Drizzle ORM; MS SQL Server (Lyceum) external integration via connection pooling; Redis 7 for BullMQ queues and multi-tiered caching.

## Feature Inventory
| # | Feature / Dimension | Description | Milestone | Source |
|---|-------------------|-------------|-----------|--------|
| F1 | Etapa 1: CORS, Env, TS Strict, Helmet, Gzip | Hardened headers, compression, secure origin matching, env validation, strict TS | M1 | Survey (Explorer 1 & 3) |
| F2 | Etapa 2: Centralized RBAC & DTO Validation | Global JwtAuthGuard, RbacGuard, @RequireModule, @RequireAdmin, class-validator | M1 | Survey (Explorer 1 & 3) |
| F3 | Etapa 3: BullMQ Async Queues & Modal UX | Queues for Lyceum and Moodle sync, 0-100% progress events, flicker-free modals | M1 | Survey (Explorer 1 & 2) |
| F4 | Etapa 4: Observability & /health Endpoint | X-Request-Id UUID propagation, logging interceptor, sanitized GlobalExceptionFilter, /health | M1 | Survey (Explorer 1 & 3) |
| F5 | Etapa 5: PostgreSQL Indexes & CacheModule | GIN Trigram and compound B-tree indexes in Drizzle, Redis CacheService with memory fallback | M1 | Survey (Explorer 1 & 3) |
| F6 | Etapa 6: Unit/E2E Tests & CI/CD Pipeline | 23 backend unit test suites (65 tests), 4 E2E suites (12 tests), GitHub Actions CI | M1 | Survey (Explorer 1 & 3) |
| F7 | Functional: Authentication & Session Flow | NextAuth v5 credentials provider, backend JWT issuance, active user check, token lifecycle | M2 | Survey (Explorer 2) |
| F8 | Functional: AVA Reports Flow | Materialized consolidated table (~14ms), Moodle sync, progress & grades views, exports | M2 | Survey (Explorer 2) |
| F9 | Functional: Academic Module (Lyceum MSSQL->PG) | Multi-entity sync (turmas, discentes, docentes, matriculas), regex sanitization, dashboard | M2 | Survey (Explorer 2) |
| F10 | Functional: Scheduling & Users/Groups Flow | Pessimistic locking (FOR UPDATE) for consecutive slots, cancellation refund, admin CRUD | M2 | Survey (Explorer 2) |
| F11 | Security: Secrets & Route Protection Audit | Verification of hardcoded credentials, plain-text connection strings, private route guards | M3 | Survey (Explorer 3) |
| F12 | Performance & Cache Lifecycle Audit | Cache TTLs, auto-invalidation on mutations, unshared caches, uncached aggregations | M3 | Survey (Explorer 3) |
| F13 | Gap Analysis & Prioritized Action Plan | Identification of technical debt, risks, impact vs complexity matrix | M4 | Survey (Synthesis) |
| F14 | Consolidated Technical Audit Report | Generation of authoritative technical markdown report in workspace root | M4 | Master Deliverable |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Survey & Scope Mapping | 3-Explorer survey mapping 6 stages, 4 functional domains, quality/security | none | DONE |
| 2 | Integrity Forensics & Security Audit | Forensic verification of secrets, route guards, cache invalidation, build/test proofs | M1 | DONE |
| 3 | Consolidated Audit Report Authoring | Compilation of comprehensive, publication-grade markdown audit report | M2 | DONE |
| 4 | Final Review & Victory Claim | Reviewer approval, gate verification, and victory claim to Sentinel | M3 | DONE |

## Code Layout
- `apps/backend/src/`: NestJS backend core logic
  - `auth/`: Guards, decorators, JWT strategies, RBAC logic
  - `cache/`: CacheService with Redis & in-memory fallback
  - `db/`: Drizzle schema, indexes, migrations
  - `jobs/`: BullMQ processors and queues
  - `academic/`, `ava-sync/`, `ava-reports/`, `scheduling/`, `users/`, `groups/`: Domain modules
  - `common/`: RequestId middleware, logging interceptor, global exception filter
  - `health/`: Multi-service health indicators
- `apps/frontend/src/`: Next.js 16 frontend
  - `app/`: App Router pages and route handlers
  - `components/`: UI components (Dashboards, Actions, Modals, Sidebar)
  - `auth.ts`, `middleware.ts`: Authentication and edge route protection
- `.github/workflows/`: CI/CD automation
- `.agents/`: Agent workspaces and investigation artifacts
- `AUDIT_REPORT.md`: Project-level consolidated report deliverable
