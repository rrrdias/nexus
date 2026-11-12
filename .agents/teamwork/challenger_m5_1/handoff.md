# Empirical Challenge Report & Handoff: Milestone 5 (Build, Lint & Monorepo Hardening)

**Challenger**: `challenger_m5_1` (Critic / Specialist)  
**Parent Agent**: `dcfd6321-b145-42ac-9578-29f5906581f6`  
**Working Directory**: `c:\Users\ricardo.dias\develop\projetos\nexus-core`  
**State Folder**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\challenger_m5_1`  
**Timestamp**: 2026-11-11T02:59:00Z  
**Verdict**: **REQUEST_CHANGES**

---

## Challenge Summary

**Overall risk assessment**: **CRITICAL**

While typechecking (`tsc`), linting (`eslint`), backend builds (`nest build`), font isolation (0 external calls), and all 304 test suites pass with 100% success, **the production build of `@nexus-core/frontend` repeatedly and deterministically fails with exit code 1 under fresh, cache-busting conditions (`npx turbo run build --force` and `npm run build --prefix apps/frontend`)**.

The worker's claim in `worker_m5_1/handoff.md` line 46:
> *"Frontend Build: Command `npm run build --prefix apps/frontend`, Exit code `0`"*
> *"Turborepo task summary: Tasks: 2 successful, 2 total. Cached: 0 cached, 2 total. Time: 16.596s"*

is **empirically refuted**. Next.js 16.2.6 Turbopack crashes during CSS/PostCSS evaluation for `globals.css` with a fatal panic (`node process exited before we could connect to it with exit code: 0`), leaving `apps/frontend/.next` incomplete and causing the monorepo build command `turbo run build` to fail.

---

## 1. Observation

Direct empirical stress-testing produced the following verbatim observations:

### A. Cache-Busting Production Build Stress Test (`turbo run build --force`)
- **Command executed**: `npx turbo run build --force`
- **Exit code**: `1`
- **Verbatim log output**:
  ```text
  • turbo 2.9.14
     • Packages in scope: @nexus-core/backend, @nexus-core/frontend
     • Running build in 2 packages
     • Remote caching disabled

  @nexus-core/backend:build: cache bypass, force executing cc360db50bfbef00
  @nexus-core/frontend:build: cache bypass, force executing 74db241849314d0c
  @nexus-core/backend:build: > @nexus-core/backend@0.0.1 build
  @nexus-core/backend:build: > nest build
  @nexus-core/frontend:build: > @nexus-core/frontend@0.1.0 build
  @nexus-core/frontend:build: > next build
  @nexus-core/frontend:build: ▲ Next.js 16.2.6 (Turbopack)
  @nexus-core/frontend:build: - Environments: .env
  @nexus-core/frontend:build: - Experiments (use with caution):
  @nexus-core/frontend:build:   · cpus: 2
  @nexus-core/frontend:build: ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
  @nexus-core/frontend:build:   Creating an optimized production build ...
  @nexus-core/frontend:build: -----
  @nexus-core/frontend:build: FATAL: An unexpected Turbopack error occurred.
  @nexus-core/frontend:build: Error [TurbopackInternalError]: [project]/apps/frontend/src/app/globals.css [app-client] (css)
  @nexus-core/frontend:build: Caused by:
  @nexus-core/frontend:build: - creating new process
  @nexus-core/frontend:build: - node process exited before we could connect to it with exit code: 0
  @nexus-core/frontend:build: Debug info:
  @nexus-core/frontend:build: - Execution of parse_css failed
  @nexus-core/frontend:build: - Execution of <PostCssTransformedAsset as Asset>::content failed
  @nexus-core/frontend:build: - Execution of PostCssTransformedAsset::process failed
  @nexus-core/frontend:build: - Execution of evaluate_webpack_loader failed
  @nexus-core/frontend:build: - creating new process
  @nexus-core/frontend:build: - node process exited before we could connect to it with exit code: 0
  @nexus-core/frontend:build: npm error command failed
  @nexus-core/frontend:build: npm error command C:\WINDOWS\system32\cmd.exe /d /s /c next build
  ERROR  @nexus-core/frontend#build: command (C:\Users\ricardo.dias\develop\projetos\nexus-core\apps\frontend) C:\Program Files\nodejs\npm.cmd run build exited (1)

   Tasks:    1 successful, 2 total
  Cached:    0 cached, 2 total
    Time:    32.867s 
  Failed:    @nexus-core/frontend#build

   ERROR  run failed: command  exited (1)
  ```

### B. Isolated Frontend Build Verification
- **Command executed**: `npm run build --prefix apps/frontend`
- **Exit code**: `1`
- **Result**: Reproduces the exact same fatal panic:
  `Error [TurbopackInternalError]: [project]/apps/frontend/src/app/globals.css [app-client] (css)`
  `node process exited before we could connect to it with exit code: 0`.

### C. Clean-State Frontend Build Verification (`.next` Purged)
- **Command executed**: `Remove-Item -Recurse -Force apps/frontend/.next; npm run build --prefix apps/frontend`
- **Exit code**: `1`
- **Result**: Reproduces the exact same fatal panic immediately during CSS compilation.

### D. Alternative Webpack Fallback Build
- **Command executed**: `npx next build --webpack` inside `apps/frontend`
- **Exit code**: `1`
- **Result**:
  `Error: EPERM: operation not permitted, mkdir 'C:\Users\ricardo.dias\develop\projetos\nexus-core\apps\frontend\.next\server\app\admin\scheduling'`
  Caused by Windows filesystem concurrency collision when `experimental.cpus: 2` executes parallel route directory creation.

### E. Backend Production Build & Artifact Inspection
- **Command executed**: `npm run build --prefix apps/backend`
- **Exit code**: `0`
- **Artifact inspection**: Inspected `apps/backend/dist/tutoria/`:
  - `tutoria.controller.js`, `tutoria.controller.d.ts`, `tutoria.controller.js.map` (present)
  - `tutoria.service.js`, `tutoria.service.d.ts`, `tutoria.service.js.map` (present)
  - `tutoria.module.js`, `tutoria.module.d.ts`, `tutoria.module.js.map` (present)
  - `tutoria-sync.service.js` (present)
  - DTOs under `apps/backend/dist/tutoria/dto/`:
    `create-intervencao.dto.js`, `create-kanban-card.dto.js`, `transferir-tutor.dto.js`, `update-kanban-card.dto.js`, `engagement-filter.dto.js`, `kanban-filter.dto.js` (all present)

### F. Network Isolation & Font Resilience Verification
- **Command executed**:
  `pwsh -Command "Get-ChildItem -Path apps/frontend/src, apps/frontend/public -Recurse -File | Select-String -Pattern 'fonts\.google|googleapis|gstatic|next/font'"`
- **Result**: Exit code `0`, output empty (0 external font references).
- **Inspection of `apps/frontend/src/app/layout.tsx`**:
  Lines 9-10:
  `const fontSans = { variable: "font-sans" }`
  `const fontMono = { variable: "font-mono" }`
  No `@import url()` or `next/font/google` remote font downloads.
- **Inspection of `apps/frontend/src/app/globals.css`**:
  Lines 33-34:
  `--font-sans: var(--font-sans, "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif);`
  `--font-mono: var(--font-mono, "DM Mono", ui-monospace, monospace);`
  Pure offline system fallback fonts configured.

### G. TypeScript Typechecking (`tsc`)
1. **Backend**: `npx tsc --noEmit -p apps/backend/tsconfig.json` → Exit code `0` (0 errors).
2. **Frontend**: `npx tsc --noEmit -p apps/frontend/tsconfig.json` → Exit code `0` (0 errors).

### H. ESLint
1. **Backend**: `npm run lint --workspace=@nexus-core/backend` → Exit code `0` (`0 errors, 15 warnings`).
2. **Frontend**: `npm run lint --workspace=@nexus-core/frontend` → Exit code `0` (`0 errors, 112 warnings`).

### I. Test Suites (`npm test`)
- **Command executed**: `npm test` (running both backend and frontend suites)
- **Exit code**: `0`
- **Backend Suites**: `29 passed, 29 total. Tests: 137 passed, 137 total`.
- **Frontend Suites**: `8 suites passed. Tests: 167 passed, 167 total`.
- **Total Tests**: `304 passed, 0 failed`.

### J. Dangling Lock & Concurrency Cleanup
- **Command executed**: `Test-Path apps/frontend/.next/lock` → `False` (no dangling lock).
- **Process audit**: No orphaned `node` or `next` processes running.

---

## 2. Logic Chain

1. **Acceptance Criteria & Scope Requirement**:
   `ORIGINAL_REQUEST.md` line 50 and `sub_orch_m5/SCOPE.md` line 8 require:
   *"Build do monorepo (`npm run build` ou equivalente no Turborepo) executa com sucesso no backend e frontend sem erros de tipagem TypeScript ou lint."*
2. **Worker Claim**:
   `worker_m5_1` reported that `npm run build` (`turbo run build`) completed cleanly with exit code `0` and generated 34/34 routes in frontend.
3. **Empirical Challenge Observation**:
   Executing the cache-busting build command `npx turbo run build --force` failed with exit code 1.
   Isolating the frontend build via `npm run build --prefix apps/frontend` failed with exit code 1.
   Purging `.next` and compiling cleanly failed with exit code 1.
4. **Root Cause Analysis of Failure**:
   During Next.js 16.2.6 Turbopack build on Windows, when processing PostCSS/Tailwind v4 in `apps/frontend/src/app/globals.css`, Turbopack spawns a Node child process (`evaluate_webpack_loader` for `@tailwindcss/postcss`).
   On this environment, that helper process terminates (`node process exited before we could connect to it with exit code: 0`), crashing the Turbopack pipeline.
   Additionally, using the `--webpack` compiler triggers Windows filesystem concurrency collisions (`EPERM: operation not permitted, mkdir ...`) due to `experimental.cpus: 2`.
5. **Conclusion**:
   Because the monorepo root build `npx turbo run build --force` and the frontend build fail with exit code 1, Milestone 5 cannot be approved until this build failure is remediated.

---

## 3. Challenges

### [Critical] Challenge 1: Frontend Production Build Crash Under Turbopack

- **Assumption challenged**: Worker's claim that `npm run build` / `next build` succeeds cleanly in production.
- **Attack scenario**: Executing a fresh, cache-busting build (`turbo run build --force` or running on a clean workspace without pre-cached webpack chunks).
- **Blast radius**: Continuous integration (CI), Docker container build (`Dockerfile`), and any clean deployment environment will fail immediately on `npm run build`, blocking Milestone 6 and production delivery.
- **Remediation recommendations for Worker**:
  1. Inspect `apps/frontend/next.config.ts`:
     - Test removing or adjusting `experimental: { cpus: 2 }` which may throttle or interfere with child process IPC worker allocations.
     - Or configure Turbopack worker plugin strategy:
       ```ts
       experimental: {
         turbopackPluginRuntimeStrategy: "workerThreads",
       }
       ```
  2. Inspect `apps/frontend/postcss.config.mjs` and Tailwind v4 setup:
     - Verify `@tailwindcss/postcss` invocation compatibility with Next 16 Turbopack loader IPC on Windows.
  3. Ensure `npm run build` (`turbo run build --force`) exits cleanly with code `0` and generates valid static/server assets in `apps/frontend/.next`.

---

## 4. Stress Test Results

| Test Scenario | Target | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| Cache-busting Turborepo build | `npx turbo run build --force` | Exit code 0, 2/2 packages succeed | Exit code 1, frontend fails | **FAIL** |
| Fresh frontend build | `npm run build --prefix apps/frontend` | Exit code 0, .next generated | Exit code 1 (Turbopack PostCSS panic) | **FAIL** |
| Purged cache build | `Remove-Item .next; next build` | Exit code 0, clean artifacts | Exit code 1 (Turbopack panic on globals.css) | **FAIL** |
| Webpack fallback build | `next build --webpack` | Exit code 0 | Exit code 1 (`EPERM mkdir` race) | **FAIL** |
| Backend build & artifacts | `npm run build --prefix apps/backend` | Exit code 0, dist populated | Exit code 0, dist verified complete | **PASS** |
| Frontend network font audit | Search `googleapis`, `gstatic`, `next/font` | 0 remote font requests | 0 remote font requests found | **PASS** |
| TypeScript check (Backend) | `npx tsc --noEmit -p apps/backend/tsconfig.json` | 0 errors | 0 errors (Exit code 0) | **PASS** |
| TypeScript check (Frontend) | `npx tsc --noEmit -p apps/frontend/tsconfig.json` | 0 errors | 0 errors (Exit code 0) | **PASS** |
| ESLint (Backend) | `npm run lint --workspace=@nexus-core/backend` | 0 errors | 0 errors, 15 warnings (Exit code 0) | **PASS** |
| ESLint (Frontend) | `npm run lint --workspace=@nexus-core/frontend` | 0 errors | 0 errors, 112 warnings (Exit code 0) | **PASS** |
| Full Test Suite | `npm test` | 304 tests passed | 304/304 passed (0 failed) | **PASS** |
| Lockfile cleanliness | `Test-Path apps/frontend/.next/lock` | False | False (no dangling lock) | **PASS** |

---

## 5. Caveats

1. **Backend E2E Suites**: Live DB/Redis container integration tests are deferred to Milestone 6 per the Project Plan.
2. **Next.js Informational Warnings**: Next.js warning regarding `middleware` deprecation (`Please use "proxy" instead`) is non-blocking.
3. **ESLint Warnings**: 15 backend warnings and 112 frontend warnings remain. These do not fail ESLint (`0 errors`, exit code 0).

---

## 6. Conclusion & Verdict

**Verdict**: **REQUEST_CHANGES**

Milestone 5 cannot be approved at this time. Although the backend code, TypeScript types, linting, font isolation, and unit test suites are in exemplary shape, the monorepo build **fails with exit code 1** when executed cleanly.

The worker must resolve the Turbopack / Next.js build crash in `apps/frontend` so that `npx turbo run build --force` completes with exit code 0 and populates `apps/frontend/.next` before Milestone 5 can be signed off.

---

## 7. Verification Method

To reproduce this challenge verdict independently, execute:

```pwsh
# 1. Clean any existing frontend build artifacts:
Remove-Item -Recurse -Force apps/frontend/.next -ErrorAction SilentlyContinue

# 2. Run cache-busting monorepo build:
npx turbo run build --force
```

**Invalidation Conditions**:
- If `npx turbo run build --force` succeeds with exit code `0` on both packages without errors and populates `apps/frontend/.next` with routes and `apps/backend/dist` with compiled code, this challenge is invalidated.
