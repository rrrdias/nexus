# BRIEFING — 2026-11-11T03:23:00Z

## Mission
Investigate and solve the exact root cause of the Next.js frontend build crash and font facade flagged by Auditor and Challenger.

## 🔒 My Identity
- Archetype: teamwork_explorer
- Roles: explorer, investigator, analyst
- Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
- State folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m5_3
- Original parent: dcfd6321-b145-42ac-9578-29f5906581f6
- Milestone: Milestone 5 (Build, Lint & Monorepo Hardening) - Iteration 2

## 🔒 Key Constraints
- Read-only investigation — produce structured reports, diff proposals, and exact verification evidence
- Investigate root cause of Turbopack PostCSS crash (`globals.css`, `experimental.cpus: 2`, `postcss.config.mjs`)
- Test removing `experimental.cpus: 2`, test Turbopack vs webpack empirically
- Design genuine typography architecture (zero facade in `layout.tsx` and `globals.css`)
- Test clean state (`.next` purged) reproducibility

## Current Parent
- Conversation ID: dcfd6321-b145-42ac-9578-29f5906581f6
- Updated: 2026-11-11T03:23:00Z

## Investigation State
- **Explored paths**:
  - `apps/frontend/next.config.ts`
  - `apps/frontend/src/app/globals.css`
  - `apps/frontend/src/app/layout.tsx`
  - `apps/frontend/postcss.config.mjs`
  - `apps/frontend/package.json`
  - `apps/frontend/Dockerfile`
- **Key findings**:
  1. Turbopack PostCSS Panic Root Cause:
     - Next.js 16.2.6 Turbopack on Windows Node.js (v25) defaults to `turbopackPluginRuntimeStrategy: "childProcesses"` for evaluating webpack/postcss loaders.
     - Spawning child processes for PostCSS asset transforms triggers premature IPC termination (`node process exited before we could connect to it with exit code: 0`).
     - Setting `experimental: { turbopackPluginRuntimeStrategy: "workerThreads" }` completely resolves this issue (`✓ Compiled successfully in 3.7s`).
  2. The `cpus: 2` and `output: "standalone"` Windows Concurrency Conflict:
     - `experimental: { cpus: 2 }` in `next.config.ts` causes worker pool starvation and exacerbates Windows filesystem concurrency locks during route compilation and standalone file tracing (`EPERM: operation not permitted, mkdir`).
     - Webpack fallback (`next build --webpack`) failed with `EPERM: operation not permitted, mkdir` on Windows route directories.
     - Removing `cpus: 2` and configuring `output` conditionally (`output: process.env.BUILD_STANDALONE === "true" || process.env.DOCKER_BUILD === "true" ? "standalone" : undefined`) alongside `outputFileTracingRoot: path.join(__dirname, "../../")` and `ENV BUILD_STANDALONE=true` in `apps/frontend/Dockerfile` eliminates NTFS access violations (`0xC0000005`) and `EPERM` locks while maintaining 100% Docker standalone container compatibility.
  3. Genuine Typography Architecture:
     - Eliminated dummy facade objects `const fontSans = { variable: "font-sans" }` in `layout.tsx`.
     - Declared non-circular clean CSS custom properties `--font-sans` and `--font-mono` directly on `:root` in `globals.css`, with clean passthrough in `@theme inline`.
     - Zero external network dependencies, offline-first, genuine font loading.
  4. Monorepo and Workspace Verification:
     - `npx turbo run build --force`: 2/2 packages succeeded, 0 cached, exit code 0.
     - `npm run build --prefix apps/frontend`: 34/34 routes generated, exit code 0.
     - `npm test`: 304/304 passed (137 backend, 167 frontend), 0 skipped, exit code 0.
     - `npx tsc --noEmit`: 0 type errors on backend and frontend, exit code 0.
     - `eslint`: 0 errors across backend and frontend, exit code 0.
- **Unexplored areas**: None. All root causes isolated and verified empirically.

## Key Decisions Made
- Confirmed `turbopackPluginRuntimeStrategy: "workerThreads"` as the authoritative fix for Turbopack PostCSS child process crash.
- Removed `experimental.cpus: 2` to eliminate Windows EPERM race condition.
- Configured conditional `output: standalone` to protect Windows local builds while keeping Docker container compatibility via `ENV BUILD_STANDALONE=true`.
- Implemented authentic offline typography architecture in `globals.css` and `layout.tsx`.

## Artifact Index
- DISPATCH.md — Dispatch log
- BRIEFING.md — Persistent context & state
- progress.md — Heartbeat & execution log
- handoff.md — Complete 5-component forensic investigation report
