# Baseline Verification & Monorepo Integrity Report

**Repository**: `nexus-core`  
**Execution Timestamp**: 2026-10-23T12:03:00Z  
**Agent**: `teamwork_preview_worker_baseline_1`  
**Platform**: Windows (win32 10.0.26100) | Shell: pwsh | Node: v25.3.0 | npm: 11.6.2 | Docker: Active  

---

## 1. Executive Summary

A comprehensive integrity baseline verification was conducted across the Nexus Core monorepo (root, NestJS backend, and Next.js 16 frontend). All builds, test suites, lint runs, and environment configurations were executed directly against the local codebase and running containerized infrastructure.

### Summary Scorecard

| Area | Command / Target | Exit Code | Result Status | Highlights |
|---|---|---|---|---|
| **Root Build** | `npm run build` | `0` | **PASS** | Turbo 2.9.14 built 2/2 packages in 38.74s |
| **Backend Build** | `npm run build` (`apps/backend`) | `0` | **PASS** | `nest build` completed cleanly |
| **Frontend Build** | `npm run build` (`apps/frontend`) | `0` | **PASS** | Next.js 16.2.6 (Turbopack) built 32 static/dynamic routes in 13.5s |
| **Backend Unit Tests** | `npm run test` (Root / Backend) | `0` | **PASS** | 26 test suites passed, 93 tests passed (18.49s) |
| **Backend E2E Tests** | `npm run test:e2e` | `1` | **FAIL (Teardown Timeout)** | 12/12 individual tests passed, but 2 of 4 suites failed in `afterAll` hook (`app.close()` exceeded 5000ms Jest hook timeout) |
| **Frontend Tests** | `npm run test` (`apps/frontend`) | `1` | **FAIL (Missing Script)** | Script `test` not configured in `apps/frontend/package.json` |
| **Frontend Unit Tests** | `npx tsx src/lib/activity-utils.test.ts` | `0` | **PASS** | 7 assertion blocks passed |
| **Frontend Unit Tests** | `npx tsx src/lib/scheduling-utils.test.ts` | `0` | **PASS** | 5 assertion blocks passed |
| **Monorepo Lint** | `npm run lint` | `0` | **PASS (With Warnings)** | 10 warnings in backend, 91 warnings in frontend, 0 errors |

---

## 2. Monorepo Architecture & Scripts Inventory

### 2.1 Workspace Structure
The monorepo uses npm workspaces managed via Turborepo (`turbo.json`):
- Root (`nexus-core`)
- Workspace `apps/backend` (`@nexus-core/backend`)
- Workspace `apps/frontend` (`@nexus-core/frontend`)

### 2.2 Complete Scripts Inventory

#### Root (`c:\Users\ricardo.dias\develop\projetos\nexus-core\package.json`)
```json
{
  "build": "turbo run build",
  "dev": "turbo run dev",
  "lint": "turbo run lint",
  "test": "npm run test --workspace=@nexus-core/backend",
  "test:e2e": "npm run test:e2e --workspace=@nexus-core/backend"
}
```
*Observation*: The root `test` and `test:e2e` scripts only delegate to `@nexus-core/backend`. Frontend tests are not invoked from the root test script.

#### Backend (`c:\Users\ricardo.dias\develop\projetos\nexus-core\apps\backend\package.json`)
```json
{
  "build": "nest build",
  "dev": "npm run start:dev",
  "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:debug": "nest start --debug --watch",
  "start:prod": "node dist/main",
  "db:push": "drizzle-kit push",
  "db:seed": "ts-node src/db/seed.ts",
  "db:reset": "ts-node src/db/reset.ts",
  "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e": "jest --config ./test/jest-e2e.json --forceExit"
}
```

#### Frontend (`c:\Users\ricardo.dias\develop\projetos\nexus-core\apps\frontend\package.json`)
```json
{
  "dev": "next dev --port 3002",
  "build": "next build",
  "start": "next start --port 3002",
  "lint": "eslint"
}
```
*Gap Identified*: `apps/frontend/package.json` lacks `"test"` and `"test:watch"` scripts even though test suites exist under `src/lib/*.test.ts`.

---

## 3. Build Command Execution & Verification

### 3.1 Monorepo Root Build
- **Command**: `npm run build`
- **Working Directory**: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
- **Exit Code**: `0`
- **Duration**: 38.736s
- **Output**:
```text
> nexus-core@1.0.0 build
> turbo run build

• turbo 2.9.14
   • Packages in scope: @nexus-core/backend, @nexus-core/frontend
   • Running build in 2 packages
   • Remote caching disabled

@nexus-core/backend:build: cache miss, executing 3935a9155495a2bd
@nexus-core/frontend:build: cache miss, executing 67df9252729a8d51

@nexus-core/frontend:build: > @nexus-core/frontend@0.1.0 build
@nexus-core/frontend:build: > next build

@nexus-core/backend:build: > @nexus-core/backend@0.0.1 build
@nexus-core/backend:build: > nest build

@nexus-core/frontend:build: ⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
@nexus-core/frontend:build:  We detected multiple lockfiles and selected the directory of C:\Users\ricardo.dias\develop\projetos\nexus-core\package-lock.json as the root directory.
@nexus-core/frontend:build:  To silence this warning, set `turbopack.root` in your Next.js config, or consider removing one of the lockfiles if it's not needed.
@nexus-core/frontend:build:  Detected additional lockfiles: 
@nexus-core/frontend:build:    * C:\Users\ricardo.dias\develop\projetos\nexus-core\apps\frontend\package-lock.json

@nexus-core/frontend:build: ▲ Next.js 16.2.6 (Turbopack)
@nexus-core/frontend:build: - Environments: .env
@nexus-core/frontend:build: - Experiments (use with caution):
@nexus-core/frontend:build:   · cpus: 2

@nexus-core/frontend:build: ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
@nexus-core/frontend:build:   Creating an optimized production build ...
@nexus-core/frontend:build: ✓ Compiled successfully in 10.7s
@nexus-core/frontend:build:   Running TypeScript ...
@nexus-core/frontend:build:   Finished TypeScript in 12.5s ...
@nexus-core/frontend:build:   Collecting page data using 2 workers ...
@nexus-core/frontend:build: ✓ Generating static pages using 2 workers (32/32) in 311ms
@nexus-core/frontend:build:   Finalizing page optimization ...

 Tasks:    2 successful, 2 total
Cached:    0 cached, 2 total
  Time:    38.736s 
```

### 3.2 Backend Isolated Build
- **Command**: `npm run build`
- **Working Directory**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\apps\backend`
- **Exit Code**: `0`
- **Output**: Clean compilation with `@nestjs/cli` (`nest build`) outputting to `dist/`.

### 3.3 Frontend Isolated Build
- **Command**: `npm run build`
- **Working Directory**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\apps\frontend`
- **Exit Code**: `0`
- **Output**: Next.js 16.2.6 Turbopack compiled 32 routes (app router), outputting standalone deployment bundle with `basePath: "/nexus"`.

### 3.4 Build Warnings & Notices
1. **Multiple Lockfiles Warning**: `apps/frontend/package-lock.json` coexists with root `package-lock.json`. Turbopack flags this and suggests removing `apps/frontend/package-lock.json` or setting `turbopack.root` in `next.config.ts`.
2. **Next.js 16 Deprecation Warning**: `The "middleware" file convention is deprecated. Please use "proxy" instead. (https://nextjs.org/docs/messages/middleware-to-proxy)`.
3. **NPM Version Notice**: System npm 11.6.2 notified update to 11.21.1.

---

## 4. Test Command Execution & Verification

### 4.1 Backend Unit Tests
- **Command**: `npm run test` (delegated from root)
- **Exit Code**: `0`
- **Suites**: 26 passed, 26 total
- **Tests**: 93 passed, 93 total
- **Execution Time**: 18.485s
- **Suites Verified**:
  - `src/cache/cache.service.spec.ts`
  - `src/scheduling/scheduling.service.spec.ts`
  - `src/scheduling/public-scheduling.controller.spec.ts`
  - `src/ava-reports/ava-reports.service.spec.ts`
  - `src/ava-reports/ava-reports.controller.spec.ts`
  - `src/ava-sync/ava-sync.service.spec.ts`
  - `src/ava-sync/ava-sync.controller.spec.ts`
  - `src/auth/rbac.guard.spec.ts`
  - `src/auth/jwt-auth.guard.spec.ts`
  - `src/auth/auth.service.spec.ts`
  - `src/auth/auth.controller.spec.ts`
  - `src/users/users.service.spec.ts`
  - `src/users/users.controller.spec.ts`
  - `src/groups/groups.service.spec.ts`
  - `src/groups/groups.controller.spec.ts`
  - `src/audit/audit.service.spec.ts`
  - `src/audit/audit.controller.spec.ts`
  - `src/common/interceptors/logging.interceptor.spec.ts`
  - `src/common/filters/global-exception.filter.spec.ts`
  - `src/app.controller.spec.ts`
  - `src/common/middleware/request-id.middleware.spec.ts`
  - `src/jobs/jobs.controller.spec.ts`
  - `src/jobs/jobs.service.spec.ts`
  - `src/health/health.controller.spec.ts`
  - `src/health/health.service.spec.ts`
  - `src/academic/academic.controller.spec.ts`

- **Runtime Observations During Unit Tests**:
  - `CacheService`: Gracefully falls back to local in-memory cache when Redis connection is unavailable (`Redis não disponível (Connection is closed.). Operando em modo de cache local em memória`).
  - `AvaSyncService`: An unhandled mock mismatch logged `[AvaSyncService] Erro ao atualizar snapshot consolidado: this.db.execute is not a function` at `ava-sync.service.ts:275:15`. The service caught the error without throwing, but this points to mock divergence between Drizzle ORM client and native `execute`.

### 4.2 Backend E2E Tests
- **Command**: `npm run test:e2e` (`jest --config ./test/jest-e2e.json --forceExit`)
- **Exit Code**: `1`
- **Suites**: 2 passed, 2 failed (4 total)
- **Tests**: 12 passed, 0 failed (12 total tests passed!)
- **Failure Cause**: Hook Timeout in `afterAll`
  - `test/jobs-and-sync.e2e-spec.ts`: `Exceeded timeout of 5000 ms for a hook (afterAll: await app.close())`
  - `test/app.e2e-spec.ts`: `Exceeded timeout of 5000 ms for a hook (afterAll: await app.close())`
- **Root Cause Analysis**:
  - `app.close()` triggers NestJS lifecycle hooks: closing BullMQ queue connections, Redis client handles, PostgreSQL pool, and Tedious/MSSQL connection pool.
  - In `apps/backend/test/jest-e2e.json`, Jest's default hook timeout is 5000ms. Closing multiple distributed clients across Windows sockets exceeded 5000ms, causing Jest to abort the teardown hook with an error.
  - Adding a default `testTimeout: 30000` or configuring `beforeAll`/`afterAll` timeouts in the e2e test files will resolve this failure cleanly.
  - In `auth-and-rbac.e2e-spec.ts` and `jobs-and-sync.e2e-spec.ts`, `LYCEUM_DB_HOST` was empty string, triggering `ConnectionError: Failed to connect to :1433 - The argument 'hostname' must be a non-empty string`. The test passed because `AcademicService` catches initialization errors, but indicates the e2e test environment lacked complete mock/stub settings for Lyceum.

### 4.3 Frontend Test Commands
- **Command**: `npm run test` in `apps/frontend`
  - **Exit Code**: `1`
  - **Output**: `npm error Missing script: "test"`
- **Direct Unit Test Execution**:
  1. `npx tsx src/lib/activity-utils.test.ts`
     - **Exit Code**: `0`
     - **Output**: 7 tests passed (3-part formats, truncated GROUP_CONCAT fragments, phase reconciliation for G2610162, grade validation).
  2. `npx tsx src/lib/scheduling-utils.test.ts`
     - **Exit Code**: `0`
     - **Output**: 5 tests passed (time parsing, consecutive slots, past slot blocking in America/Sao_Paulo timezone, `filterValidStartSlots`, `calculateDatesStatus`).

---

## 5. Monorepo Lint Results (`npm run lint`)

- **Command**: `npm run lint` (Turbo run lint)
- **Exit Code**: `0` (Tasks: 2 successful, 2 total, 27.93s)
- **Results**:
  - `@nexus-core/backend`: 0 errors, 10 warnings
    - 4 unused variables (`audit.controller.ts`, `fix-grades.ts`, `seed.ts`, `scheduling.service.ts`)
    - 4 floating promises (`fix-grades.ts:60`, `main.ts:75`, `test_mat.ts:19,24`)
  - `@nexus-core/frontend`: 0 errors, 91 warnings
    - 89 unused variables / unused imports (mostly unused icons imported from `lucide-react` across dashboard and report components)
    - 1 React Hook warning in `GradeDetailDialog.tsx:95:7`: `react-hooks/set-state-in-effect` (calling `setSelectedTab` synchronously within `useEffect`)
    - 1 unused variable in `scheduling-utils.test.ts`

---

## 6. Environment & System Requirements

### 6.1 Runtime Versions
- **Node.js**: `v25.3.0`
- **npm**: `11.6.2` (notice for 11.21.1)
- **Platform**: Windows 11 Enterprise (win32 x64)

### 6.2 Running Services & Infrastructure
Docker containers are currently active and healthy on the host:
- `nexus_core_postgres` (`postgres:16-alpine`): Port `5433:5432` (healthy)
- `nexus_core_redis` (`redis:7-alpine`): Port `6379:6379` (healthy)
- `nexus_core_backend`: Port `3004:3004`
- `nexus_core_frontend`: Port `3002:3002`

### 6.3 Environment Files
- Monorepo root: `.env` and `.env.example`
- Backend: `apps/backend/.env`
- Frontend: `apps/frontend/.env`

### 6.4 Key Environment Variables Configuration
| Variable | Description | Canonical / Example Value |
|---|---|---|
| `PORT` / `BACKEND_PORT` | Backend HTTP Port | `3004` (or `3001` dev) |
| `FRONTEND_PORT` | Frontend HTTP Port | `3002` |
| `DATABASE_URL` | PostgreSQL Connection String | `postgresql://admin:1213122@localhost:5433/core_db` |
| `REDIS_HOST` / `REDIS_PORT` | BullMQ & Cache Redis | `localhost` / `6379` |
| `JWT_SECRET` | Backend Auth Secret | Secret string |
| `CRON_SECRET` | Header-protected Cron Secret | Secret string |
| `AUTH_SECRET` | NextAuth / Auth.js Secret | Secret string |
| `AUTH_URL` | NextAuth callback base URL | `http://localhost:3002/api/auth` |
| `NEXT_PUBLIC_API_URL` | Public Backend API endpoint | `http://localhost:3004` |
| `LYCEUM_DB_*` | SQL Server for Lyceum Views | `HOST`, `PORT` (1433), `DATABASE`, `USERNAME`, `PASSWORD` |
| `NEXUS_DEFAULT_PERIOD` | Academic Period | `2026-2` |
| `NEXUS_FASE1..3_*` | Phase 1, 2, 3 Date ranges | ISO Date strings (`YYYY-MM-DD`) |

---

## 7. Actionable Recommendations & Roadmap

1. **Fix Backend E2E Test Teardown (`test:e2e`)**:
   - Update `apps/backend/test/jest-e2e.json` to include `"testTimeout": 30000`.
   - In `jobs-and-sync.e2e-spec.ts` and `app.e2e-spec.ts`, specify explicit timeout for `afterAll(async () => { await app.close(); }, 15000)`.
2. **Add Frontend Test Scripts**:
   - Add `"test": "tsx --test src/lib/*.test.ts"` or `"test": "tsx src/lib/activity-utils.test.ts && tsx src/lib/scheduling-utils.test.ts"` to `apps/frontend/package.json`.
   - Update root `package.json` to execute tests across both workspaces using `turbo run test`.
3. **Consolidate Lockfiles**:
   - Delete duplicate `apps/frontend/package-lock.json` so Turbopack and npm workspaces reference the single root `package-lock.json`.
4. **Next.js 16 Proxy Migration**:
   - Rename/refactor Next.js `middleware.ts` to `proxy.ts` (or follow Next.js 16 recommended convention) to eliminate the deprecation warning.
5. **Lint Cleanup**:
   - Fix `GradeDetailDialog.tsx:95` to avoid synchronous `setState` in `useEffect`.
   - Clean up unused imports in frontend components to reduce 91 lint warnings.
