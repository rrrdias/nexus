## 2026-11-11T02:00:25Z
You are teamwork_worker for Milestone 5 (Build, Lint & Monorepo Hardening).
Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
State folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m5_1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY INPUTS:
- Read c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md
- Read c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md
- Read c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m5\SCOPE.md
- Read c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m5_1\handoff.md
- Read c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m5_2\handoff.md

YOUR EXCLUSIVE WRITE BOUNDARIES:
- `apps/backend/src/scheduling/guards/student-session.guard.spec.ts`
- `apps/frontend/src/components/Topbar.tsx`
- `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx`
- `apps/frontend/src/components/tutoria/TutoriaTimeline.tsx`
- `apps/frontend/src/components/tutoria/BatonPassDialog.tsx`
- `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx`
- `apps/frontend/src/app/layout.tsx`
- `apps/frontend/src/app/globals.css`
- `apps/frontend/package.json`
- `package.json` (root)

DETAILED IMPLEMENTATION TASKS:
1. Fix Backend ESLint Error:
   - In `apps/backend/src/scheduling/guards/student-session.guard.spec.ts`:
     Replace inline `const crypto = require('crypto');` on line 45 with top-level `import * as crypto from 'crypto';`.
2. Fix Frontend ESLint Errors & Unused Import Cleanups:
   - In `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx`:
     - Line 745: Change `let text = ...` to `const text = ...`.
     - Remove unused imports (`TrendingUp`, `Download`, `getTutoriaSyncStatus`).
   - In `apps/frontend/src/components/Topbar.tsx`:
     - Refactor to construct JSX outside of `try/catch`. Wrap only `await auth()` inside `try/catch` to resolve all 5 `react-hooks/error-boundaries` errors while preserving fallback behavior when `auth()` fails.
   - In `apps/frontend/src/components/tutoria/TutoriaTimeline.tsx`:
     - Remove unused import `Sparkles`.
   - In `apps/frontend/src/components/tutoria/BatonPassDialog.tsx`:
     - Remove unused import `DialogFooter`.
   - In `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx`:
     - Remove unused imports (`Phone`, `Mail`, `BookOpen`, `ArrowRight`, `Edit3`, `Layers`, `ExternalLink`).
3. Make Next.js Font Loading 100% Offline Resilient:
   - In `apps/frontend/src/app/layout.tsx`:
     - Remove `import { Plus_Jakarta_Sans, DM_Mono } from "next/font/google"`.
     - Define static font variables:
       `const fontSans = { variable: "font-sans" };`
       `const fontMono = { variable: "font-mono" };`
   - In `apps/frontend/src/app/globals.css`:
     - Ensure fallback font stacks for `--font-sans` and `--font-mono` using standard system fonts:
       `--font-sans: var(--font-sans, "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif);`
       `--font-mono: var(--font-mono, "DM Mono", ui-monospace, monospace);`
   - Ensure clean build directory without orphaned `.next/lock`.
4. Connect Real Frontend Test Suite:
   - In `apps/frontend/package.json`:
     - Replace the dummy `"test": "echo ..."` with a command executing all 8 unit and feature test suites under `apps/frontend/src/lib/`:
       `"test": "npx tsx src/lib/activity-utils.test.ts && npx tsx src/lib/scheduling-utils.test.ts && npx tsx src/lib/tutoria-adversarial.test.ts && npx tsx --tsconfig tsconfig.json src/lib/tutoria-kanban-m4.test.ts && npx tsx --tsconfig tsconfig.json src/lib/tutoria-kanban-m4-adversarial.test.ts && npx tsx --tsconfig tsconfig.json src/lib/tutoria-challenger-m4.test.ts && npx tsx --tsconfig tsconfig.json src/lib/tutoria-empirical-challenge.test.ts && npx tsx src/lib/tutoria-e2e.test.ts"`
   - In root `package.json`:
     - Ensure `"test"` script runs both backend and frontend workspaces:
       `"test": "npm run test --workspace=@nexus-core/backend && npm run test --workspace=@nexus-core/frontend"`
5. Comprehensive Verification:
   - Run TypeScript typecheck:
     `npx tsc --noEmit -p apps/backend/tsconfig.json`
     `npx tsc --noEmit -p apps/frontend/tsconfig.json`
   - Run ESLint on both workspaces:
     `npm run lint --workspace=@nexus-core/backend` (must exit 0 with 0 errors)
     `npm run lint --workspace=@nexus-core/frontend` (must exit 0 with 0 errors)
   - Run builds:
     `npm run build --prefix apps/backend` (must exit 0)
     `npm run build --prefix apps/frontend` (must exit 0 without Google Fonts network errors)
     `npm run build` at monorepo root (must exit 0)
   - Run test suites:
     `npm test --prefix apps/backend` (must pass 137/137 tests)
     `npm test --prefix apps/frontend` (must pass all 8 suites / 167 tests)
     `npm test` at monorepo root (must pass both workspaces)

OUTPUT:
Write your full handoff report to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m5_1\handoff.md` and notify your parent via `send_message` when complete.
