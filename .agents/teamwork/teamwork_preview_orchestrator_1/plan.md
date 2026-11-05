# Plan — Nexus Core Technical Audit, Architectural Analysis & Roadmap

## Overview
Comprehensive review and audit of Nexus Core covering:
- R1: Security, Auth & Access Control
- R2: Concurrency, Transactions & Booking Performance
- R3: AVA & Lyceum Integration Resilience
- R4: Code Quality, Frontend Next.js 16 Patterns & UX
- R5: Consolidated Audit Report & Prioritized Roadmap
- Monorepo build and test execution & verification

## Execution Phases

### Phase 0: Survey & Baseline Verification
- Step 0.1: Monorepo Baseline Verification
  - Worker runs `npm run build` and `npm run test` across backend and frontend, captures errors, warnings, test coverage, and environment configuration.
- Step 0.2: Parallel Exploration & Scope Mapping
  - Explorer 1 (Survey - Backend & Auth & Concurrency): Inventory NestJS controllers, routes, guards (`@Public`, `@RequireModule`), RBAC, session cookie management, Drizzle ORM schema, transaction blocks, and `FOR UPDATE` locking.
  - Explorer 2 (Survey - Integrations & Background Processing): Inventory BullMQ queues, `AvaSyncService`, `LyceumSyncService`, snapshot consolidation, failure tolerance, connection pooling, and error handling.
  - Explorer 3 (Survey - Frontend & UX & Next.js 16): Inventory Next.js 16 App Router structure, middleware, Server vs Client components, Server Actions, mobile UX in the booking stepper flow, error handling, and security headers.
- Step 0.3: Synthesize PROJECT.md with architecture, inventory, and detailed milestone breakdown.

### Phase 1: Deep Technical Audits & Empirical Verification
- Milestone 1: R1 Security, Auth & Access Control Audit
  - 100% controller and route mapping table with authorization status.
  - Student temporary session cookie security analysis (30m session, CSRF, entropy, third-party enrollment access).
  - SQL injection, XSS, sensitive env/credential exposure, Helmet, CSP, CORS headers.
- Milestone 2: R2 Concurrency, Transactions & Booking Performance Audit
  - 30-min consecutive booking mechanism stress & race condition analysis.
  - Transaction atomicity, `FOR UPDATE` lock analysis in Drizzle ORM, rollback/cancellation slot release.
  - I/O query bottlenecks, missing database indexes on `opcaos`, `agendamentos_matricula`, `locais`, `relatorios`.
- Milestone 3: R3 AVA & Lyceum Integration Resilience Audit
  - BullMQ queue configuration, retry backoffs, dead-letter strategies, timeout handling for MSSQL/MySQL.
  - Snapshot consolidation consistency, avoiding event loop starvation or duplicate sync runs.
- Milestone 4: R4 Code Quality, Frontend Next.js 16 & UX Audit
  - Server Actions, Next.js 16 best practices, error masking, mobile responsiveness across booking flow.

### Phase 2: Consolidated Report & Prioritized Roadmap (R5)
- Categorized findings: Critical, High, Medium, Low/Improvement.
- Impact vs. Effort matrix.
- Concrete, actionable remediation plan with referenced code snippets and architectural recommendations.

### Phase 3: Review, Verification & Victory Audit
- Verification by reviewer and forensic auditor.
- Present final consolidated report and notify parent Sentinel.
