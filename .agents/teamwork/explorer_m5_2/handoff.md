# Handoff Report: Monorepo Build, Font Resilience & Test Suite Audit (Milestone 5)

## 1. Observation

### 1.1 Build Scripts & Turborepo Configuration
- **Root `package.json`**:
  - Line 10: `"build": "turbo run build"`
  - Line 12: `"lint": "turbo run lint"`
  - Line 13: `"test": "npm run test --workspace=@nexus-core/backend"`
  - Line 14: `"test:e2e": "npm run test:e2e --workspace=@nexus-core/backend"`
  - *Observation*: Root `test` script only delegates to the backend workspace; frontend test suites are omitted from the root test target.
- **Root `turbo.json`**:
  - Tasks defined: `build` (depends on `^build`, outputs `dist/**`, `.next/**`, `!.next/cache/**`), `lint`, `dev`.
  - *Observation*: No `test` task configured in `turbo.json`.
- **`apps/backend/package.json`**:
  - Line 9: `"build": "nest build"`
  - Line 25: `"lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"`
  - Line 26: `"test": "jest"`
  - Line 30: `"test:e2e": "jest --config ./test/jest-e2e.json --forceExit"`
- **`apps/frontend/package.json`**:
  - Line 7: `"build": "next build"`
  - Line 9: `"lint": "eslint"`
  - Line 10: `"test": "echo \"@nexus-core/frontend: unit tests verified\" && exit 0"`
  - *Observation*: The frontend `test` script is a dummy echo command despite the existence of 8 comprehensive test suites (167 tests total) in `apps/frontend/src/lib/`.

---

### 1.2 Monorepo Build Execution Audit

#### 1.2.1 Backend Build (`npm run build --prefix apps/backend`)
- **Command**: `npm run build --prefix apps/backend`
- **Exit Code**: `0` (Success)
- **Log Output**:
  ```
  > @nexus-core/backend@0.0.1 build
  > nest build
  ```
- **Dist Artifacts**: Built cleanly to `apps/backend/dist/` without errors or warnings.

#### 1.2.2 Frontend Build (`npm run build --prefix apps/frontend`)
- **Command**: `npm run build --prefix apps/frontend`
- **Exit Code**: `1` (Fatal Failure)
- **Verbatim Error**:
  ```
  > @nexus-core/frontend@0.1.0 build
  > next build

  ▲ Next.js 16.2.6 (Turbopack)
  - Environments: .env
  - Experiments (use with caution):
    · cpus: 2

  ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
    Creating an optimized production build ...
  Turbopack build encountered 2 warnings:
  [next]/internal/font/google/dm_mono_27399902.module.css
  Error while requesting resource
  There was an issue establishing a connection while requesting https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap

  [next]/internal/font/google/plus_jakarta_sans_2874600c.module.css
  Error while requesting resource
  There was an issue establishing a connection while requesting https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&display=swap

  > Build error occurred
  Error: Turbopack build failed with 2 errors:
  [next]/internal/font/google/dm_mono_27399902.module.css
  next/font: error:
  Failed to fetch `DM Mono` from Google Fonts.

  [next]/internal/font/google/plus_jakarta_sans_2874600c.module.css
  next/font: error:
  Failed to fetch `Plus Jakarta Sans` from Google Fonts.
  ```

#### 1.2.3 Monorepo Root Build (`npm run build`)
- **Command**: `npm run build` (`turbo run build`)
- **Exit Code**: `1` (Failure)
- **Log Output**:
  - `@nexus-core/backend:build`: Successful.
  - `@nexus-core/frontend:build`: Failed with code 1 due to the identical Google Fonts network error.
  - Turborepo Summary: `Tasks: 1 successful, 2 total. Failed: @nexus-core/frontend#build`.

---

### 1.3 Next.js Font Loading Configuration & Offline Resilience Audit
- **File**: `apps/frontend/src/app/layout.tsx`
  - Lines 2 & 10–19:
    ```tsx
    import { Plus_Jakarta_Sans, DM_Mono } from "next/font/google"

    const fontSans = Plus_Jakarta_Sans({
      subsets: ["latin"],
      variable: "--font-sans"
    })

    const fontMono = DM_Mono({
      subsets: ["latin"],
      weight: ["400", "500"],
      variable: "--font-mono"
    })
    ```
  - Line 51:
    ```tsx
    <body className={`${fontSans.variable} ${fontMono.variable} font-sans flex h-screen bg-[#F4F5F7] antialiased overflow-hidden`}>
    ```
- **File**: `apps/frontend/src/app/globals.css`
  - Lines 33–35:
    ```css
    --font-sans: var(--font-sans);
    --font-mono: var(--font-mono);
    --font-heading: var(--font-sans);
    ```
- **Local Font Availability**:
  - Running `Get-ChildItem -Path apps/frontend -Recurse -File -Include *.woff*,*.ttf,*.otf` revealed that font files only existed as ephemeral artifacts in `.next/static/media` from prior online builds. No permanent local font assets existed in `src/` or `public/`.
- **Behavior in Sandboxed / Air-Gapped / Offline Environments**:
  - Turbopack and Webpack in Next.js require live access to `fonts.googleapis.com` when compiling `next/font/google`.
  - When network access is restricted or offline, Next.js throws an unrecoverable build error (`Failed to fetch ... from Google Fonts`).

---

### 1.4 Full Test Suite Audit

#### 1.4.1 Backend Test Suite (`npm test --prefix apps/backend`)
- **Command**: `npm test --prefix apps/backend` (Jest unit test suite)
- **Exit Code**: `0` (Success)
- **Summary**:
  - Test Suites: `29 passed, 29 total`
  - Tests: `137 passed, 137 total (0 failed, 0 skipped)`
  - Execution Time: ~7.85s
  - All critical service and controller specs passed cleanly (including `tutoria.service.spec.ts`, `scheduling.service.spec.ts`, `auth.service.spec.ts`, `student-session.guard.spec.ts`, `cache.service.spec.ts`, etc.).

#### 1.4.2 Backend E2E Test Suite (`npm run test:e2e --prefix apps/backend`)
- **Command**: `npm run test:e2e --prefix apps/backend`
- **Exit Code**: `1` (Expected failure in Milestone 5 without live external databases / Redis container)
- **Summary**:
  - Test Suites: `5 failed, 5 total`
  - Tests: `25 failed, 72 passed, 97 total`
  - Failures stem from:
    1. Unreachable Redis service (`connect EACCES 127.0.0.1:6379`) in `jobs-and-sync.e2e-spec.ts` and `observability.e2e-spec.ts`.
    2. 12 state-continuation assertions in `test/tutoria-multitutor.e2e-spec.ts` (e.g. TC-T1-F1-04, TC-T1-F2-01, TC-T4-SCN-01).
  - *Note*: Full E2E suite validation is formally assigned to Milestone 6 (`M6: Final Milestone: E2E Test Suite & Hardening`).

#### 1.4.3 Frontend Test Suites Audit (`apps/frontend/src/lib/`)
We verified the complete execution of all frontend unit, integration, challenger, and adversarial test suites using `npx tsx`:

| # | Test Suite File | Type | Tests | Status |
|---|-----------------|------|-------|--------|
| 1 | `apps/frontend/src/lib/activity-utils.test.ts` | Unit (Moodle grade/date parser) | 7 / 7 | PASS |
| 2 | `apps/frontend/src/lib/scheduling-utils.test.ts` | Unit (Time slot / timezone calculations) | 5 / 5 | PASS |
| 3 | `apps/frontend/src/lib/tutoria-adversarial.test.ts` | Adversarial / Boundary (Server Actions M3) | 47 / 47 | PASS |
| 4 | `apps/frontend/src/lib/tutoria-challenger-m4.test.ts` | Empirical Challenger (Kanban DnD stress M4) | 15 / 15 | PASS |
| 5 | `apps/frontend/src/lib/tutoria-kanban-m4.test.ts` | Feature Suite (Lead badge, recency, baton pass) | 25 / 25 | PASS |
| 6 | `apps/frontend/src/lib/tutoria-kanban-m4-adversarial.test.ts` | Adversarial Stress (Input injection, 48h precision) | 29 / 29 | PASS |
| 7 | `apps/frontend/src/lib/tutoria-empirical-challenge.test.ts` | Empirical Challenger (Timeline, Form, SSR) | 23 / 23 | PASS |
| 8 | `apps/frontend/src/lib/tutoria-e2e.test.ts` | Standalone Frontend E2E / Server Actions | 16 / 16 | PASS |
| **Total** | **8 Test Suites** | **Frontend Test Coverage** | **167 / 167** | **100% PASS** |

---

### 1.5 TypeScript Typecheck & ESLint Audit

#### 1.5.1 TypeScript Typecheck
- **Backend Typecheck**: `npx tsc --noEmit -p apps/backend/tsconfig.json` -> Exit `0` (Clean, 0 errors).
- **Frontend Typecheck**: `npx tsc --noEmit -p apps/frontend/tsconfig.json` -> Exit `0` (Clean, 0 errors).

#### 1.5.2 Backend ESLint (`Set-Location apps\backend; npx eslint "{src,test}/**/*.ts"`)
- **Result**: `16 problems (1 error, 15 warnings)`
- **Verbatim Error**:
  - `apps/backend/src/scheduling/guards/student-session.guard.spec.ts:45:22`:
    `error: A require() style import is forbidden @typescript-eslint/no-require-imports`
    Caused by line 45: `const crypto = require('crypto');` instead of top-level ESM `import * as crypto from 'crypto';`.

#### 1.5.3 Frontend ESLint (`Set-Location apps\frontend; npx eslint .`)
- **Result**: `130 problems (6 errors, 124 warnings)`
- **Verbatim Errors**:
  - `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx:745:11`:
    `error: 'text' is never reassigned. Use 'const' instead prefer-const`
    Caused by line 745: `let text = diffDays <= 0 ? "Hoje" : diffDays === 1 ? "Ontem" : ...;`
  - `apps/frontend/src/components/Topbar.tsx` (Lines 34:7, 35:9, 36:11, 39:9, 41:13):
    `5 errors: Error: Avoid constructing JSX within try/catch react-hooks/error-boundaries`
    Caused by wrapping the entire JSX return statement of `Topbar` inside a `try/catch` block instead of only catching `await auth()`.

---

## 2. Logic Chain

1. **Build Failure Chain**:
   - `turbo run build` calls `next build` in `apps/frontend`.
   - `apps/frontend/src/app/layout.tsx` imports `Plus_Jakarta_Sans` and `DM_Mono` from `next/font/google`.
   - In sandboxed or offline execution, DNS resolution and HTTPS egress to `fonts.googleapis.com` are rejected/blocked.
   - Next.js Turbopack terminates the build with 2 fatal errors, exiting with code 1.
   - Therefore, the monorepo root build fails because Turborepo halts on `@nexus-core/frontend#build` failure.

2. **Font Resilience Resolution Chain**:
   - `next/font/google` is exclusively imported in `apps/frontend/src/app/layout.tsx`.
   - In `globals.css`, the typography tokens `--font-sans` and `--font-mono` are configured via CSS variables.
   - By defining standard system and fallback font stacks directly in CSS variables (or bundling local woff2 fonts via `next/font/local`) and replacing `next/font/google` with local font variables in `layout.tsx`, `next build` will never make remote HTTP calls.
   - Consequently, the frontend build becomes 100% hermetic and resilient in any offline/sandboxed CI environment.

3. **Test Suite Completeness Chain**:
   - Backend unit tests pass 100% (137/137 tests across 29 suites).
   - Frontend test files in `apps/frontend/src/lib/*.test.ts` contain 167 robust tests across 8 suites covering all Milestones M1–M4.
   - All 167 tests execute and pass 100% under `npx tsx`.
   - However, `apps/frontend/package.json` only specifies a dummy echo for `"test"`, and root `package.json` does not run frontend tests.
   - Therefore, updating `apps/frontend/package.json` to execute all 8 test suites ensures that frontend regression tests run reliably and automatically in CI and Turborepo.

4. **Lint Hardening Chain**:
   - Backend has exactly 1 lint error: `student-session.guard.spec.ts:45:22` (`require('crypto')`).
   - Frontend has exactly 6 lint errors:
     - 1 in `TutoriaDashboard.tsx:745:11` (`let text` -> `const text`).
     - 5 in `Topbar.tsx` (JSX inside `try/catch`).
   - Eliminating these 7 errors achieves a 0-error ESLint state across both workspaces.

---

## 3. Caveats

- **Caveat 1 — Backend E2E Tests (Milestone 6 Scope)**:
  - Backend E2E tests (`npm run test:e2e --prefix apps/backend`) require active Redis and database services, and contain 12 assertions being finalized in Milestone 6. Milestone 5 strictly targets build, lint, and unit test hardening.
- **Caveat 2 — Next.js 16 Proxy Warning**:
  - Next.js emits `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` This is an informational deprecation warning from Next.js 16 and does not break the build.
- **Caveat 3 — Frontend React Hook Warnings**:
  - Frontend ESLint emits warnings for `react-hooks/set-state-in-effect` in several admin scheduling components. These are non-blocking warnings and do not fail the build or typecheck.

---

## 4. Conclusion & Concrete Action Plan for Implementation

### Root Causes Summary
1. **Frontend Build Failure**: Next.js Turbopack fails due to Google Font fetching (`next/font/google`) in `apps/frontend/src/app/layout.tsx`.
2. **Missing Frontend Test Execution**: `apps/frontend/package.json` has a dummy echo for `"test"`, omitting the 167 passing tests.
3. **Backend Lint Error**: 1 error in `apps/backend/src/scheduling/guards/student-session.guard.spec.ts` using `require('crypto')`.
4. **Frontend Lint Errors**: 1 error in `TutoriaDashboard.tsx` (`let text` without reassignment) and 5 errors in `Topbar.tsx` (JSX inside `try/catch`).

### Concrete Recommendations for Worker Implementation

#### Fix 1: Make Next.js Font Loading 100% Offline / Hermetic
In `apps/frontend/src/app/layout.tsx`:
- Remove `import { Plus_Jakarta_Sans, DM_Mono } from "next/font/google"`
- Provide static font variables:
  ```tsx
  const fontSans = { variable: "font-sans" }
  const fontMono = { variable: "font-mono" }
  ```
- In `apps/frontend/src/app/globals.css`, declare resilient system fallbacks:
  ```css
  --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "DM Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  ```

#### Fix 2: Resolve Backend ESLint Error in `student-session.guard.spec.ts`
In `apps/backend/src/scheduling/guards/student-session.guard.spec.ts`:
- Replace inline `const crypto = require('crypto');` on line 45 with a top-level ESM import:
  ```ts
  import * as crypto from 'crypto';
  ```

#### Fix 3: Resolve Frontend ESLint Errors in `TutoriaDashboard.tsx` and `Topbar.tsx`
1. In `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx` line 745:
   - Change `let text = ...` to `const text = ...`.
2. In `apps/frontend/src/components/Topbar.tsx`:
   - Move JSX construction outside of `try/catch`. Wrap only the async call `session = await auth()` in `try/catch`:
   ```tsx
   export async function Topbar() {
     let session = null
     try {
       session = await auth()
     } catch (error) {
       console.error("[Topbar] Erro ao recuperar sessão:", error)
     }

     const rawName = typeof session?.user?.name === "string" ? session.user.name.trim() : ""
     // ... compute initials, userGroup, safeSession ...

     return (
       <header className="...">
         ...
       </header>
     )
   }
   ```

#### Fix 4: Wire Frontend Test Suites in `apps/frontend/package.json`
Update `"test"` script in `apps/frontend/package.json` to execute all 8 test suites:
```json
"test": "npx tsx apps/frontend/src/lib/activity-utils.test.ts && npx tsx apps/frontend/src/lib/scheduling-utils.test.ts && npx tsx apps/frontend/src/lib/tutoria-adversarial.test.ts && npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-kanban-m4.test.ts && npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-kanban-m4-adversarial.test.ts && npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-challenger-m4.test.ts && npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-empirical-challenge.test.ts && npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts"
```
And in root `package.json`, update `"test"` to run both workspaces:
```json
"test": "npm run test --workspace=@nexus-core/backend && npm run test --workspace=@nexus-core/frontend"
```

---

## 5. Verification Method

Once the worker applies the proposed fixes, verify with the following exact commands:

1. **Verify Backend Build**:
   ```pwsh
   npm run build --prefix apps/backend
   ```
   *Expected*: Exit code 0, cleanly builds to `apps/backend/dist/`.

2. **Verify Frontend Offline Build**:
   ```pwsh
   npm run build --prefix apps/frontend
   ```
   *Expected*: Exit code 0, Turbopack completes production build without Google Font network fetch errors.

3. **Verify Full Monorepo Build**:
   ```pwsh
   npm run build
   ```
   *Expected*: Turborepo executes `@nexus-core/backend#build` and `@nexus-core/frontend#build` with 2/2 successful tasks.

4. **Verify Backend Unit Tests**:
   ```pwsh
   npm test --prefix apps/backend
   ```
   *Expected*: 29/29 suites passed, 137/137 tests passed.

5. **Verify Frontend Test Suites**:
   ```pwsh
   npm test --prefix apps/frontend
   ```
   *Expected*: All 8 test suites pass (167/167 tests).

6. **Verify Clean ESLint (0 errors)**:
   ```pwsh
   Set-Location apps\backend; npx eslint "{src,test}/**/*.ts"
   Set-Location apps\frontend; npx eslint .
   ```
   *Expected*: 0 errors in both backend and frontend.

7. **Invalidation Conditions**:
   - If `next build` continues to attempt network connections to `fonts.googleapis.com`.
   - If any of the 137 backend tests or 167 frontend tests fail.
   - If ESLint exits with code 1 in either workspace.
