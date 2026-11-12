# Scope: Milestone 5 (Build, Lint & Monorepo Hardening)

## Architecture
- **Monorepo**: Turborepo root `nexus-core` with workspaces `apps/backend` and `apps/frontend`.
- **Target**:
  1. Full TypeScript typecheck across backend and frontend (`npx tsc --noEmit -p apps/backend/tsconfig.json` and `npx tsc --noEmit -p apps/frontend/tsconfig.json`).
  2. Full ESLint checks across backend and frontend, resolving any lint warnings/errors in modified or specified files (`student-session.guard.spec.ts`, `TutoriaDashboard.tsx`, `Topbar.tsx`, etc.).
  3. Offline font download resilience or build config ensuring `npm run build` succeeds cleanly across all workspaces.
  4. Full regression testing ensuring all backend tests and frontend tests pass without failures.

## Feature Inventory (Milestone 5)
| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| 15 | F15: Monorepo Build & Lint Limpo | Correção de lint no backend/frontend, tipagem e build sem falhas | M5 | DONE |

## Code Layout & Write Boundaries
- Fixes and hardening across:
  - `apps/backend` (lint configs, spec files)
  - `apps/frontend` (lint configs, Next.js build adjustments, component cleanup)
- Verification targets:
  - `npm run build --prefix apps/backend`
  - `npm run build --prefix apps/frontend` (or `npm run build` at root)
  - `npx eslint` on backend and frontend
  - `npm run test` on backend and frontend
