# Handoff Report — Forensic Integrity Audit of Nexus Core

**Auditor Agent**: `teamwork_preview_auditor_1`  
**Working Directory**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork_preview_auditor_1`  
**Target Recipient**: `dfe2df8e-12c4-420c-9a93-e62f3bffe328` (Parent Orchestrator)  
**Date**: September 18, 2026  
**Type**: Hard Handoff (Audit Complete)

---

## 1. Observation

Direct, verbatim observations from empirical source code and filesystem inspection:

### 1.1 Secrets & Plaintext Credentials
1. **`apps/backend/inspect_mat.js` (lines 6–16)**:
   ```javascript
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
   *Confirmed*: Script committed in `apps/backend/` containing institutional SQL Server database credentials in plaintext.

2. **`apps/backend/src/auth/auth.module.ts` (line 10)**:
   ```typescript
   secret: process.env.JWT_SECRET || 'nexus-secret-key-2026',
   ```

3. **`apps/backend/src/auth/jwt-auth.guard.ts` (line 44)**:
   ```typescript
   secret: process.env.JWT_SECRET || 'nexus-secret-key-2026'
   ```
   *Confirmed*: Static fallback cryptographic signing key present in both JWT issuance and verification logic.

4. **`apps/backend/migrate.js` (line 7)**:
   ```javascript
   const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/nexus_core";
   ```

5. **`apps/backend/src/db/reset.ts` (line 13)**:
   ```typescript
   const newPassword = await hashPassword('admin');
   ```

### 1.2 Route Protection & Authorization
1. **`apps/backend/src/app.module.ts` (lines 43–50)**:
   `JwtAuthGuard` and `RbacGuard` are registered globally as `APP_GUARD`.
2. **`@Public()` Decorator Inventory**:
   Grep scan reveals exactly 4 `@Public()` usages in backend:
   - `AppController` (`GET /`)
   - `AuthController` (`POST /api/auth/login`)
   - `HealthController` (`GET /health`)
   - `AvaSyncController` (`GET /api/ava-sync`), which internally validates Bearer `CRON_SECRET` using `crypto.timingSafeEqual`.
3. **Domain Controllers**:
   All 7 controllers (`AcademicController`, `AvaReportsController`, `JobsController`, `SchedulingController`, `UsersController`, `GroupsController`, `SystemController`) enforce `@RequireModule()` and/or `@RequireAdmin()`. Zero private backend routes are unprotected.
4. **Frontend Middleware (`apps/frontend/src/middleware.ts`)**:
   Redirects all unauthenticated requests to `/nexus/login`. Does not perform role/module checks on Next.js page transitions.

### 1.3 Cache Lifecycle & Invalidation
1. **`apps/backend/src/cache/cache.service.ts`**:
   Hybrid cache using `ioredis` with graceful in-memory `Map` fallback, TTL expiration, and auto-cleanup (> 2000 entries).
2. **Automated Mutation Invalidation**:
   - `UsersService` (lines 151, 163, 175) invokes `cacheService.del('rbac:user:${userId}:modules')` and `RbacGuard.clearCache(userId)`.
   - `GroupsService` (lines 80, 103, 115) invokes `cacheService.delByPattern('rbac:user:*')` and `RbacGuard.clearCache()`.
   - `AvaSyncService` (line 237) invokes `cacheService.delByPattern('ava:dropdowns:*')`.
3. **Stale Cache Gaps**:
   - `JwtAuthGuard.userActiveCache` has 30s TTL in memory and is NOT invalidated when `UsersService.toggleUserActive` deactivates a user.
   - `AcademicService.academicAccessCache` has 60s TTL (isolated static map, currently dead code).
   - `AvaReportsService.getAvaDashboardStats` performs un-cached heavy SQL aggregations with regex replacements on every invocation.

### 1.4 Authentic Implementation vs Facade
1. **BullMQ Queues**: `AcademicSyncProcessor` (concurrency 1) and `AvaSyncProcessor` (concurrency 2) implement genuine workers, SQL Server pool queries, Moodle API requests, chunking (1000 items), and dynamic progress tracking (0% to 100%).
2. **PostgreSQL Indexes**: `apps/backend/src/db/schema.ts` and `drizzle/0001_performance_indexes.sql` implement real GIN Trigram indexes (`gin_trgm_ops`) on all search fields, composite B-tree indexes for multi-column filters, and unique constraints.
3. **Scheduling Concurrency**: `SchedulingService.createBooking` executes inside a database transaction with pessimistic row locking `FOR UPDATE` on consecutive slots, capacity verification, and atomic capacity restoration (+1) on cancellation.
4. **Observability**: `RequestIdMiddleware` binds UUIDs to requests and response headers; `GlobalExceptionFilter` sanitizes error details in production; `/health` performs genuine latency probes against DB, Redis, and Lyceum MSSQL.
5. **Modals**: `ConsolidatedActions.tsx` and `AcademicDashboard.tsx` mount a persistent `<AlertDialog>` preventing UI flicker during state transitions (`confirming` -> `syncing` -> `success`/`error`).

---

## 2. Logic Chain

1. **User Constraint Baseline**:
   `ORIGINAL_REQUEST.md` line 38 sets an explicit non-functional acceptance criterion: *"Ausência de secrets hardcoded no código-fonte"*.
2. **Direct Observation of Credentials**:
   `apps/backend/inspect_mat.js` contains plaintext credentials (`Port4eeC0nsult@Tudo.`, `172.29.44.90`, `PortAeeConsult`) to an actual institutional database server. `auth.module.ts` and `jwt-auth.guard.ts` contain static fallback cryptographic secrets (`nexus-secret-key-2026`).
3. **Deduction on Criterion Compliance**:
   Because plaintext production credentials and static secrets are committed in source files, Acceptance Criterion #38 is demonstrably violated.
4. **Evaluation of Functional Authenticity**:
   All 6 modernization milestones were independently inspected for facade patterns (e.g. constant return values, empty mocks in production code, self-certifying dummy tests). None were found. The business logic, queue processing, index definitions, and error filters are 100% authentic and robust.
5. **Synthesis to Verdict**:
   Per the forensic auditor protocol, if any check fails, the verdict must be INTEGRITY VIOLATION. The security failure in credentials hygiene constitutes an integrity violation against user-stipulated acceptance criteria.

---

## 3. Caveats

1. **External Lyceum MSSQL Network Reachability**: The auditor did not attempt live TCP connectivity to `172.29.44.90:1433` to verify whether the database is accessible from the internet or restricted to internal VPN/VPC networks. Regardless of network isolation, hardcoding credentials in source code is an integrity violation.
2. **Frontend Automated Test Execution**: The frontend workspace currently has 0 test files (`.spec.tsx` or `.test.tsx`). No automated assertions could be executed against React components, though static Turbopack build succeeded with 0 type errors.

---

## 4. Conclusion

- **Integrity Verdict**: 🔴 **INTEGRITY VIOLATION**
- **Actionable Remediation**:
  1. Immediately delete `apps/backend/inspect_mat.js` and rotate the `PortAeeConsult` password on the Lyceum database.
  2. Implement fail-fast validation during backend bootstrap to reject initialization if `JWT_SECRET` is unset or insecure.
  3. Remove empty spurious file `=` and duplicate lockfile `apps/frontend/package-lock.json`.
  4. Cache `getAvaDashboardStats` in `CacheService` with a 5-minute TTL.
  5. Add an eviction call to `JwtAuthGuard.userActiveCache` upon user deactivation.

---

## 5. Verification Method

To independently reproduce and verify these findings:

1. **Inspect Hardcoded Credentials**:
   - Run view on `apps/backend/inspect_mat.js`: lines 6–16.
   - Run view on `apps/backend/src/auth/auth.module.ts`: line 10.
   - Run view on `apps/backend/src/auth/jwt-auth.guard.ts`: line 44.
2. **Verify Route Authorization Coverage**:
   - Search for `@Public()` across `apps/backend/src`: confirms only 4 public endpoints exist.
   - Inspect `apps/backend/src/app.module.ts`: lines 43–50 confirm global `APP_GUARD` registration.
3. **Verify Build & Test Integrity**:
   - Run unit tests: `npx jest --runInBand` from `apps/backend` (passes 23 suites, 65 tests, 100% green).
   - Run E2E tests: `npx jest --config ./test/jest-e2e.json` from `apps/backend` (passes 4 suites, 12 tests, 100% green).
