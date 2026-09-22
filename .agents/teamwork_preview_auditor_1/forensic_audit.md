# Forensic Integrity Audit Report — Nexus Core Monorepo

**Work Product**: Nexus Core Monorepo (apps/backend NestJS 11 + apps/frontend Next.js 16)  
**Auditor**: `teamwork_preview_auditor_1` (Forensic Integrity Auditor)  
**Date**: September 18, 2026  
**Profile**: General Project (Integrity Enforcement Mode: Development per `ORIGINAL_REQUEST.md`)  
**Verdict**: 🔴 **INTEGRITY VIOLATION** (Due to Hardcoded Plain-Text Production Database Credentials & Static Secret Fallbacks)

---

## Executive Summary & Authoritative Verdict

A forensic integrity examination was conducted across the Nexus Core monorepo to evaluate the authenticity of modernization implementations, credentials hygiene, route authorization coverage, cache lifecycle mechanics, and conformance to user constraints defined in `ORIGINAL_REQUEST.md`.

### Verdict Breakdown

| Dimension | Integrity Assessment | Status |
|---|---|:---:|
| **1. Modernization Implementation Authenticity** | **CLEAN (100% Authentic)** — All 6 modernization implementations (BullMQ async queues, Drizzle PostgreSQL GIN/composite indexes, X-Request-Id propagation, GlobalExceptionFilter, /health multi-service probe, and flicker-free modal states) are genuine production logic. Zero facades, zero dummy stubs, zero hardcoded test cheats. | ✅ CLEAN |
| **2. Route Protection & Authorization** | **CLEAN (Closed by Default)** — 100% of private backend routes are protected via global `APP_GUARD` (`JwtAuthGuard`, `RbacGuard`). Exactly 4 endpoints are annotated with `@Public()`, and `AvaSyncController` uses constant-time `timingSafeEqual` comparison. Edge middleware enforces login redirection. | ✅ CLEAN |
| **3. Cache Lifecycle & Invalidation** | **QUALIFIED PASS (Minor Stale Gaps)** — Robust hybrid Redis cache with in-memory map fallback. RBAC and AVA dropdown caches invalidate automatically on mutations. Residual gaps exist in `JwtAuthGuard.userActiveCache` (30s deactivation window) and uncached `getAvaDashboardStats`. | ⚠️ MINOR GAPS |
| **4. Secrets & Credentials Baseline** | **INTEGRITY VIOLATION** — **Plain-text production credentials for an institutional Microsoft SQL Server database** are hardcoded in `apps/backend/inspect_mat.js`. Static fallback secrets exist in `auth.module.ts` and `jwt-auth.guard.ts`. Directly violates Acceptance Criterion #38 of `ORIGINAL_REQUEST.md`: *"Ausência de secrets hardcoded no código-fonte"*. | 🔴 VIOLATION |

**Final Authoritative Verdict**: **INTEGRITY VIOLATION**. While the core functional and architectural implementations are authentic and robust, the inclusion of live database credentials in repository source code violates fundamental security integrity criteria. Immediate remediation is mandatory.

---

## 1. Item 1: Secrets & Credentials Forensic Analysis

### 1.1 Verified Violations

#### Violation 1.1: Plain-Text Production Database Credentials in `apps/backend/inspect_mat.js`
- **Location**: `apps/backend/inspect_mat.js` (lines 6-16)
- **Classification**: **CRITICAL INTEGRITY VIOLATION** (CWE-798: Use of Hard-coded Credentials)
- **Empirical Evidence (Verbatim Code)**:
  ```javascript
  // apps/backend/inspect_mat.js lines 6-16
  const config = {
    user: process.env.LYCEUM_DB_USERNAME || 'PortAeeConsult',
    password: process.env.LYCEUM_DB_PASSWORD || 'Port4eeC0nsult@Tudo.',
    server: process.env.LYCEUM_DB_HOST || '172.29.44.90',
    port: parseInt(process.env.LYCEUM_DB_PORT || '1433'),
    database: process.env.LYCEUM_DB_DATABASE || 'Lyceum',
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };
  ```
- **Forensic Finding**: `inspect_mat.js` is a committed JavaScript file in the backend repository root. It provides default fallbacks containing real institutional database host IP (`172.29.44.90`), port `1433`, database name `Lyceum`, username `PortAeeConsult`, and raw plaintext password `Port4eeC0nsult@Tudo.`.
- **Blast Radius**: Full compromise of institutional academic database (grades, student records, enrollment history) if the codebase or repository is accessible to unauthorized personnel.
- **Remediation**:
  1. Immediately delete `apps/backend/inspect_mat.js` from the codebase.
  2. Rotate the database password for `PortAeeConsult` on SQL Server instance `172.29.44.90`.
  3. Ensure network firewalls block all external/insecure routing to IP `172.29.44.90:1433`.

---

#### Violation 1.2: Static Fallback JWT Secret in Authentication Module & Guard
- **Locations**:
  - `apps/backend/src/auth/auth.module.ts` (line 10)
  - `apps/backend/src/auth/jwt-auth.guard.ts` (line 44)
- **Classification**: **HIGH SEVERITY INTEGRITY VIOLATION** (CWE-321: Use of Hard-coded Cryptographic Key)
- **Empirical Evidence (Verbatim Code)**:
  ```typescript
  // apps/backend/src/auth/auth.module.ts:10
  JwtModule.register({
    global: true,
    secret: process.env.JWT_SECRET || 'nexus-secret-key-2026',
    signOptions: { expiresIn: '2h' },
  }),

  // apps/backend/src/auth/jwt-auth.guard.ts:44
  const payload = await this.jwtService.verifyAsync(token, {
    secret: process.env.JWT_SECRET || 'nexus-secret-key-2026'
  });
  ```
- **Forensic Finding**: If `JWT_SECRET` is missing in runtime environment, both the token issuer and token validator silently default to `'nexus-secret-key-2026'`.
- **Blast Radius**: An attacker knowing this public key can forge valid JWT tokens with `isSuperAdmin: true` and execute administrative actions on the backend.
- **Remediation**: Implement strict fail-fast validation in `main.ts` or `app.module.ts`: if `!process.env.JWT_SECRET` or `process.env.JWT_SECRET.length < 32`, throw a fatal exception and abort bootstrap.

---

#### Violation 1.3: Static Fallback PostgreSQL Connection String in Migration Script
- **Location**: `apps/backend/migrate.js` (line 7)
- **Classification**: **MEDIUM SEVERITY DEBT**
- **Empirical Evidence (Verbatim Code)**:
  ```javascript
  // apps/backend/migrate.js:7
  const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/nexus_core";
  ```
- **Forensic Finding**: Migration script contains hardcoded local database URL fallback.

---

#### Violation 1.4: Hardcoded Reset Password in `apps/backend/src/db/reset.ts`
- **Location**: `apps/backend/src/db/reset.ts` (lines 12-17)
- **Classification**: **LOW/MEDIUM SEVERITY DEBT**
- **Empirical Evidence (Verbatim Code)**:
  ```typescript
  // apps/backend/src/db/reset.ts:12-17
  console.log('Resetando senha para admin...');
  const newPassword = await hashPassword('admin');
  await db.update(users)
    .set({ password: newPassword })
    .where(eq(users.email, 'rrrdias25@gmail.com'));
  ```
- **Forensic Finding**: Utility script hardcodes password `'admin'` and target email `'rrrdias25@gmail.com'`. In contrast, `seed.ts` properly enforces `process.env.SEED_ADMIN_PASSWORD`.

---

## 2. Item 2: Route Protection & Authorization Forensic Analysis

### 2.1 Backend Route Protection Architecture: Closed by Default
Inspection of `apps/backend/src/app.module.ts` confirms that the backend strictly adheres to the principle of "Closed by Default":

```typescript
// apps/backend/src/app.module.ts:43-50
providers: [
  AppService,
  {
    provide: APP_GUARD,
    useClass: JwtAuthGuard,
  },
  {
    provide: APP_GUARD,
    useClass: RbacGuard,
  },
  ...
]
```

Every endpoint in the application requires a valid JWT token representing an active user (`isActive === true`) AND satisfies RBAC module/role requirements unless explicitly annotated with `@Public()`.

### 2.2 Comprehensive Controller Inventory & Guard Status

| Controller | Route Prefix | Class Decorator | Method / Path | Decorator / Protection | Audit Verdict |
|---|---|---|---|---|:---:|
| **AppController** | `/` | None | `GET /` | `@Public()` | ✅ Valid Public Ping |
| **AuthController** | `/api/auth` | None | `POST /login` | `@Public()` | ✅ Valid Public Login |
| **HealthController** | `/health` | None | `GET /` | `@Public()` | ✅ Valid Public Healthcheck |
| **AvaSyncController** | `/api/ava-sync` | `@Public()` | `GET /` | Constant-time Bearer `CRON_SECRET` validation via `crypto.timingSafeEqual` | ✅ Valid Secured Cron Endpoint |
| **AcademicController** | `/api/academic` | `@RequireModule('academic')` | `POST /sync` | `@RequireAdmin()` | ✅ Strictly Protected |
| | | | `GET /discentes` | Requires `academic` | ✅ Strictly Protected |
| | | | `GET /discentes/:m/disciplinas` | Requires `academic` | ✅ Strictly Protected |
| | | | `GET /docentes` | Requires `academic` | ✅ Strictly Protected |
| | | | `GET /docentes/:d/disciplinas` | Requires `academic` | ✅ Strictly Protected |
| | | | `GET /turmas` | Requires `academic` | ✅ Strictly Protected |
| **AvaReportsController** | `/api/ava-reports` | `@RequireModule('ava')` | `POST /sync` | `@RequireAdmin()` | ✅ Strictly Protected |
| | | | `POST /progress`, `/progress/export` | Requires `ava` | ✅ Strictly Protected |
| | | | `POST /grades`, `/grades/export` | Requires `ava` | ✅ Strictly Protected |
| | | | `POST /consolidated`, `/consolidated/export` | Requires `ava` | ✅ Strictly Protected |
| | | | `GET /dashboard-stats` | Requires `ava` | ✅ Strictly Protected |
| **JobsController** | `/api/jobs` | `@RequireModule('academic', 'ava')` | `GET /:queue/:id/status` | Requires `academic` OR `ava` | ✅ Strictly Protected |
| **SchedulingController** | `/api/scheduling` | `@RequireModule('scheduling', 'backoffice')` | `GET /locals`, `GET /options`, `GET /profile/:m/:p`, `GET /bookings`, `POST /bookings`, `GET /export` | Requires `scheduling` OR `backoffice` | ✅ Strictly Protected |
| | | | `POST /locals`, `PUT /locals/:id`, `POST /options`, `PUT /options/:id`, `POST /bookings/:id/conclude`, `POST /bookings/:id/absent`, `DELETE /bookings/:id`, `POST /import` | `@RequireAdmin()` | ✅ Strictly Protected (Admin-only) |
| **UsersController** | `/api/users` | `@RequireAdmin()` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PUT /:id/active`, `DELETE /:id` | All methods require Super Admin | ✅ Strictly Protected |
| **GroupsController** | `/api/groups` | `@RequireAdmin()` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` | All methods require Super Admin | ✅ Strictly Protected |
| **SystemController** | `/api/system` | None | `GET /modules`, `GET /sidebar-modules` | Authenticated Active User | ✅ Strictly Protected |
| | | | `GET /admin-dashboard` | `@RequireAdmin()` | ✅ Strictly Protected |

**Conclusion on Route Protection**: **0 private backend routes are unprotected.** Route protection conformance is **100%**.

### 2.3 Frontend Route Protection & Edge Middleware
- `apps/frontend/src/middleware.ts` intercepts all requests (excluding static assets and `/api/auth`). Unauthenticated users are redirected to `/nexus/login`.
- **Gaps Identified**:
  1. Edge middleware lacks module-level RBAC routing. Users navigate to `/academic` or `/admin/scheduling` without being blocked at the Next.js router level; the page shell loads and subsequent API calls return 403 Forbidden.
  2. `isDisabled` is checked at `middleware.ts:26`, but NextAuth `auth.ts` does not inject `isDisabled` into the session token.

---

## 3. Item 3: Cache Lifecycle & Invalidation Forensic Analysis

### 3.1 Cache Architecture (`apps/backend/src/cache/cache.service.ts`)
The `CacheService` is a global NestJS module featuring a hybrid resilient caching architecture:
- Primary Store: Redis via `ioredis` with non-blocking initialization (`lazyConnect: true`, 2000ms connect timeout).
- Secondary Store (Graceful Fallback): In-memory `Map<string, MemoryCacheEntry>` with TTL verification (`expiresAt`) and automatic cleanup if map size exceeds 2000 entries.
- Pattern Deletion: `delByPattern(pattern)` supports Redis wildcard scans and memory regex translation (`^pattern.replace(/\*/g, '.*')$`).

### 3.2 Cache Invalidation on Mutations

| Resource / Pattern | Configured TTL | Invalidation Trigger | Code Location | Verdict |
|---|:---:|---|---|:---:|
| User RBAC Modules (`rbac:user:${userId}:modules`) | 300s (5 min) | PUT `/api/users/:id`<br>PUT `/api/users/:id/active`<br>DELETE `/api/users/:id` | `users.service.ts:151`<br>`users.service.ts:163`<br>`users.service.ts:175` | ✅ Automated Invalidation |
| Group RBAC Permissions (`rbac:user:*`) | 300s (5 min) | POST `/api/groups`<br>PUT `/api/groups/:id`<br>DELETE `/api/groups/:id` | `groups.service.ts:80`<br>`groups.service.ts:103`<br>`groups.service.ts:115` | ✅ Automated Invalidation |
| AVA Filter Dropdowns (`ava:dropdowns:*`) | 600s (10 min) | On Moodle Sync Completion | `ava-sync.service.ts:237` | ✅ Automated Invalidation |
| Active User Check (`JwtAuthGuard.userActiveCache`) | 30s | **None** (Expires by time only) | `jwt-auth.guard.ts:50-76` | ⚠️ 30s Stale Window on Deactivation |
| Academic Module Access (`AcademicService.academicAccessCache`) | 60s | **None** (Expires by time only) | `academic.service.ts:19` | ℹ️ Dead Code (Superseded by `RbacGuard`) |
| AVA Dashboard Stats (`getAvaDashboardStats`) | **Uncached** | Executes full SQL aggregation on every request | `ava-reports.service.ts:862-910` | ⚠️ Missing Cache on Heavy Query |
| Scheduling Locations & Options | **Uncached** | Direct DB queries | `scheduling.service.ts` | ℹ️ Minor DB Overhead |

**Conclusion on Cache Lifecycle**: Invalidation on core RBAC and AVA dropdowns is properly implemented and functional. The only notable gap is that `JwtAuthGuard.userActiveCache` does not expose an eviction method for `UsersService.toggleUserActive`, allowing a 30-second window before a deactivated user is rejected.

---

## 4. Item 4: Authentic Implementation vs Facade Forensic Analysis

A forensic inspection was performed to verify whether recent modernization claims are genuine production logic or superficial facades.

### 4.1 Modernization Component Verification Table

| # | Claimed Modernization Component | Evidence & File Inspection | Logic Verification | Facade or Authentic? |
|---|---|---|---|:---:|
| **1** | **BullMQ Async Queues & Concurrency** | `jobs.module.ts`<br>`academic-sync.processor.ts`<br>`ava-sync.processor.ts`<br>`jobs.service.ts` | Registered queues (`academic-sync` concurrency 1, `ava-sync` concurrency 2). Real background workers calling Lyceum SQL Server and Moodle API endpoints with real database writes, chunking (1000 records), and dynamic progress reporting. | **AUTHENTIC** (Zero Facade) |
| **2** | **Progress Reporting 0–100%** | `academic-sync.processor.ts:23`<br>`ava-sync.processor.ts:58-62` | Real progress calculations. `AvaSyncProcessor` dynamically weights task batches from 5% to 98% with descriptive steps, ending at 100%. | **AUTHENTIC** (Zero Facade) |
| **3** | **Drizzle PostgreSQL Strategic Indexes** | `schema.ts:118-121, 213-216`<br>`0001_performance_indexes.sql` | GIN Trigram indexes (`gin_trgm_ops`) on student name, course name, email, matricula. Composite B-tree indexes for screen filters. Unique constraints preventing duplicate progress and grade records. | **AUTHENTIC** (Zero Facade) |
| **4** | **Pessimistic Scheduling Locks** | `scheduling.service.ts:272, 291, 365` | Database transactions using PostgreSQL `FOR UPDATE` pessimistic row locking on `opcao` slots. Consecutive slot allocation based on enrolled disciplines count, capacity verification, and automatic vacancy restoration (+1) on cancellation. | **AUTHENTIC** (Zero Facade) |
| **5** | **X-Request-Id UUID Middleware** | `request-id.middleware.ts`<br>`logging.interceptor.ts`<br>`global-exception.filter.ts` | Intercepts all requests, reuses incoming header or generates `crypto.randomUUID()`, injects `req.requestId`, sets response header `X-Request-Id`, passes to logging interceptor and exception filter. | **AUTHENTIC** (Zero Facade) |
| **6** | **GlobalExceptionFilter & Error Sanitization** | `global-exception.filter.ts:20-74` | Structured error envelope (`success: false`, `statusCode`, `error`, `message`, `timestamp`, `path`, `requestId`). Hides internal stack traces in production (`NODE_ENV === 'production'`). | **AUTHENTIC** (Zero Facade) |
| **7** | **Multi-Service `/health` Endpoint** | `health.service.ts`<br>`health.controller.ts` | Genuine latency checks for PostgreSQL (`SELECT 1`), Redis (`academicQueue.count()`), and Lyceum MSSQL. Returns process memory (`rssMb`, `heapTotalMb`, `heapUsedMb`) and uptime. Returns HTTP 503 if PostgreSQL is down; HTTP 200 with `'degraded'` if auxiliary services are down. | **AUTHENTIC** (Zero Facade) |
| **8** | **Flicker-Free Modal State Management** | `ConsolidatedActions.tsx:138-255`<br>`AcademicDashboard.tsx:120-158` | Single `<AlertDialog open={syncStatus !== 'idle'}>` remains mounted in the DOM. Internal transitions (`confirming` -> `syncing` -> `success` / `error`) happen via conditional content rendering without unmounting the modal portal. Backdrop dismiss is blocked during active sync. | **AUTHENTIC** (Zero Facade) |

**Conclusion on Implementation Authenticity**: **100% AUTHENTIC.** No mock shortcuts, no facade return values, no dummy implementations exist in the production runtime codebase.

---

## 5. Build and Test Verification

### 5.1 Build Verification (`npm run build`)
- Monorepo build succeeds across both workspaces via Turborepo (`2/2 tasks green`).
- Backend (`nest build`): Generates full bundle in `dist/`.
- Frontend (`next build`): Compiles with Turbopack in ~8.7s and generates 30 routes without type errors.

### 5.2 Unit Tests (`npm run test`)
- 23 test suites, 65 tests total.
- **Pass rate: 100% (65 passed, 0 failed)** when executed with `--runInBand` or constrained workers.
- *Root Cause of Windows Heap Crash*: Under standard `npm run test` on Windows, parallel workers with `ts-jest` exhaust Node's default heap memory. Fixed by executing with `--runInBand`.

### 5.3 E2E Tests (`npm run test:e2e`)
- 4 test suites, 12 tests total.
- **Pass rate: 100% (12 passed, 0 failed)**.
- Covers: `app.e2e-spec.ts`, `auth-and-rbac.e2e-spec.ts`, `jobs-and-sync.e2e-spec.ts`, `observability.e2e-spec.ts`.

---

## 6. Comprehensive Forensic Findings & Action Plan

```
================================================================================
                    FORENSIC INTEGRITY AUDIT ACTION MATRIX
================================================================================

[P0 - BLOCKING INTEGRITY VIOLATIONS]
1. EXCLUDE AND PURGE `apps/backend/inspect_mat.js`
   - File contains hardcoded credentials: user 'PortAeeConsult', password 'Port4eeC0nsult@Tudo.', host '172.29.44.90'.
   - Action: Remove inspect_mat.js from git tracking, rotate credentials on SQL Server, ensure IP is inaccessible externally.

2. REMOVE STATIC JWT SECRET FALLBACKS ('nexus-secret-key-2026')
   - In `apps/backend/src/auth/auth.module.ts:10` and `apps/backend/src/auth/jwt-auth.guard.ts:44`.
   - Action: Replace fallback with a strict fail-fast check: if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required').

[P1 - SECURITY & ARCHITECTURAL GAPS]
3. CLEAN UP REPOSITORY HYGIENE
   - Remove spurious empty file `=` at repository root.
   - Delete redundant lockfile `apps/frontend/package-lock.json` to prevent npm workspace resolution warnings.

4. ENABLE FAIL-ON-ERROR IN CI WORKFLOW
   - `.github/workflows/ci.yml:49`: Remove `continue-on-error: true` from the lint step so that lint errors block PR merges.

5. CACHE AVA DASHBOARD AGGREGATIONS
   - Wrap `getAvaDashboardStats` in `CacheService.wrap('ava:dashboard:stats', ..., 300)` with a 5-minute TTL to prevent high CPU loads on PostgreSQL.

[P2 - CODE QUALITY & RESILIENCY]
6. INVALIDATE ACTIVE USER CACHE ON DEACTIVATION
   - Add a public static method `JwtAuthGuard.clearUserCache(userId)` and invoke it in `UsersService.toggleUserActive` and `UsersService.deleteUser`.

7. REMOVE DEAD ACCESS CACHE IN ACADEMIC SERVICE
   - Remove `AcademicService.academicAccessCache` (lines 19-20) as authorization is handled centrally by `RbacGuard`.

8. FIX ASYMMETRIC FRONTEND REPORT ROUTES & SIDEBAR
   - Standardize report routes (`/relatorios/progresso/ead`, `/relatorios/notas/ead`) and restore navigation links in `SidebarClient.tsx`.
================================================================================
```

---

## 7. Sign-Off & Verdict Attestation

**Auditor Attestation**:  
I hereby certify that this audit was performed independently and empirically against the live codebase of Nexus Core. All file paths, line references, code snippets, and execution outcomes have been verified directly.

- **Integrity Verdict**: 🔴 **INTEGRITY VIOLATION**
- **Violation Ground**: Direct breach of Acceptance Criterion #38 in `ORIGINAL_REQUEST.md` (*"Ausência de secrets hardcoded no código-fonte"*), evidenced by plain-text institutional SQL Server credentials in `apps/backend/inspect_mat.js` and hardcoded static fallback secrets in `auth.module.ts` and `jwt-auth.guard.ts`.
- **Recommendation**: Reject work product until P0 security violations are remediated and verified.
