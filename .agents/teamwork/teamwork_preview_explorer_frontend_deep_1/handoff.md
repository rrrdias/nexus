# Handoff Report: Frontend, Next.js 16 Patterns, Server Actions & Mobile UX Deep Audit

## 1. Observation

1. **Server Actions Error Masking & Inconsistencies**:
   - In `apps/frontend/src/app/actions/api.ts` (lines 30-33 & 45-47), `fetchFromApi` throws raw `Error` (`throw new Error(error?.message || ...)`).
   - In `apps/frontend/src/app/actions/users.ts` (lines 23-28, 40-45, 49-54, 58-61) and `groups.ts` (lines 19-24, 32-37, 41-44), operations execute `await fetchFromApi(...)` without `try/catch` and return `{ success: true }`.
   - In `UserFormDialog.tsx` (lines 78-87) and `GroupFormDialog.tsx` (lines 60-70), client forms catch errors via `catch (err: any) { setError(err.message) }`. Under Next.js 16 production mode (`NODE_ENV=production`), unhandled server exceptions are masked with a cryptographic digest (`An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive information. A digest was provided by the server: <hash>`), blinding administrators to backend validation errors.
   - In `scheduling.ts` (lines 17-33, 51-67), `createLocal`, `updateLocal`, `createOption`, `updateOption` throw directly, whereas `createBooking`, `cancelBooking`, `concludeBooking` catch and return `{ success: false, error }`.

2. **App Router Layout & Boundary Gaps**:
   - In `apps/frontend/src/app/layout.tsx` (lines 42-63), `const session = await auth()` is executed at the root layout for all requests, including public student traffic to `/agendamento`.
   - In `layout.tsx` (line 45-46), `h-screen overflow-hidden` is applied to both `<html>` and `<body>`.
   - Search across `apps/frontend/src/app` returned **0 `error.tsx`**, **0 `loading.tsx`**, and **0 `not-found.tsx`** files.

3. **Student Stepper Mobile UX & Voucher Printing**:
   - In `apps/frontend/src/app/agendamento/StudentBookingWizard.tsx` (line 76), `const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)` and in `StudentSchedulingClient.tsx` (line 45) `const [viewMode, setViewMode] = useState(...)` are stored exclusively in local component state without Browser History API synchronization. Pressing the Android/iOS hardware or gesture back button triggers window-level popstate, exiting the app to AVA Moodle.
   - In `StudentBookingWizard.tsx` (lines 366-430), the local polo card nests an `<a>` inside a `<button>` (`<button ...><a href={loc.linkLocal} ...>Ver Mapa</a></button>`), violating HTML5 specifications and causing React hydration and event propagation issues.
   - In `StudentVoucherDialog.tsx` (lines 329-366), voucher printing dynamically creates a `0x0` invisible iframe with `document.write(html)` and a hardcoded `setTimeout(..., 250)`. In iOS Safari (WebKit) and Android Chrome/WebView, printing invisible iframes fails or yields blank sheets.

4. **Code Quality, ESLint & Monorepo Test Infrastructure**:
   - Running `npx eslint src/` in `apps/frontend` identified **91 warnings (0 errors)**:
     - 69 `@typescript-eslint/no-unused-vars` (unused Lucide icons and parameter placeholders).
     - 15 `react-hooks/set-state-in-effect` (including `GradeDetailDialog.tsx:95` and `ActivityListDialog.tsx:66` where `useEffect` synchronizes `faseActive` into `selectedTab`).
     - 4 `react-hooks/purity` (`apps/frontend/src/app/page.tsx:228-231` calling impure `Date.now()` during render).
     - 3 `react-hooks/exhaustive-deps`.
   - `apps/frontend/src/lib/scheduling-utils.test.ts` contains 193 lines of passing unit tests, but `apps/frontend/package.json` contains no `"test"` script.
   - `turbo.json` lacks a `"test"` task; root `package.json` only runs backend tests; a duplicate `apps/frontend/package-lock.json` exists alongside the root lockfile.

## 2. Logic Chain

1. *From Obs 1*: Because Next.js 16 enforces server action digest masking in production, throwing unhandled exceptions in `api.ts` directly strips descriptive backend messages (e.g., 400 validation, 409 conflict). Replacing throws with a typed `ActionResult<T> = { success: true, data: T } | { success: false, error: string, code?: string }` ensures error payloads are serialized as standard JSON RSC data, bypassing Next.js redaction.
2. *From Obs 2*: Because `layout.tsx` is monolithic and applies `h-screen overflow-hidden` with `await auth()`, public student traffic incurs NextAuth JWT verification overhead and mobile browser scrolling/dynamic viewports are broken. Organizing into Route Groups `(admin)` vs `(student)` isolates the admin shell (Sidebar, Topbar, IdleTimeoutProvider) from the student experience.
3. *From Obs 3*: Because step transitions do not push history entries, browser back actions bubble to the window level and navigate away from `/agendamento`. Synchronizing `step` and `viewMode` with `window.history.pushState` and URL search parameters intercepts the back button to navigate backwards within the wizard.
4. *From Obs 3*: Because modern mobile browsers block or fail print dialogs on detached 0-height iframes, switching to CSS `@media print` rules on a visible DOM container provides reliable AirPrint / Android print support and allows direct PDF download.
5. *From Obs 4*: In `GradeDetailDialog.tsx:95`, `faseActive` is a prop that can directly derive `selectedTab = isSinglePhase ? faseActive : userSelectedTab` during render, eliminating `useEffect`, cascading renders, and ESLint warnings.
6. *From Obs 4*: Adding `"test": "tsx src/lib/scheduling-utils.test.ts"` to `apps/frontend/package.json`, configuring `"test"` in `turbo.json`, and deleting `apps/frontend/package-lock.json` restores monorepo CI/CD consistency and test coverage.

## 3. Caveats

- Investigation was performed strictly in **read-only mode**; no application source code files were modified.
- Full verification of Next.js production digest masking was analyzed against the Next.js 16 / React 19 architecture specifications and existing client try/catch blocks; reproduction in an active production container requires a production build (`next build && next start`).
- No caveats regarding code locations, AST patterns, or test execution results.

## 4. Conclusion

The Nexus Core frontend possesses a modern foundation (Next.js 16, React 19, Tailwind, Turborepo), but suffers from four critical systemic flaws:
1. **Server Actions Digest Masking**: Breaks production error reporting for administrators and staff.
2. **Monolithic Root Layout & Route Boundary Void**: Leaks admin providers, degrades mobile viewport scrolling, and lacks any error/loading boundaries.
3. **Mobile Stepper UX & Voucher Printing**: Lacks History API integration (ejecting mobile students on back swipe) and relies on deprecated iframe `doc.write` printing.
4. **Code Quality & CI Configuration**: 91 ESLint warnings and unconfigured frontend test runners in Turborepo.

A detailed technical report with concrete remediation code blocks has been written to `frontend_ux_audit.md`.

## 5. Verification Method

1. **Verify ESLint Census & Warnings**:
   ```bash
   cd apps/frontend
   npm run lint
   ```
   *Expected output*: Exactly 91 warnings (69 `@typescript-eslint/no-unused-vars`, 15 `react-hooks/set-state-in-effect`, 4 `react-hooks/purity`, 3 `react-hooks/exhaustive-deps`).

2. **Verify Frontend Unit Test Execution**:
   ```bash
   cd apps/frontend
   npx tsx src/lib/scheduling-utils.test.ts
   ```
   *Expected output*: 5 test suites pass (Test 1: Time parsing, Test 2: Exam end time, Test 3: Past time blocking America/Sao_Paulo, Test 4: Consecutive block filtering, Test 5: Calendar indicators).

3. **Verify App Router Boundaries Absence**:
   Inspect `apps/frontend/src/app` for `error.tsx`, `loading.tsx`, `not-found.tsx`. Notice 0 matches.

4. **Inspect Audit Artifact**:
   Read `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_explorer_frontend_deep_1\frontend_ux_audit.md`.
