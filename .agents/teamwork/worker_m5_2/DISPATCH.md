## 2026-11-11T03:24:44Z
You are teamwork_worker (Worker 2) for Milestone 5 (Build, Lint & Monorepo Hardening) - Iteration 2.
Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
State folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m5_2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY INPUTS:
- Read c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md
- Read c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md
- Read c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m5\SCOPE.md
- Read c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m5_3\handoff.md
- Read c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\auditor_m5_1\handoff.md
- Read c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\challenger_m5_1\handoff.md

YOUR EXCLUSIVE WRITE BOUNDARIES:
- `apps/frontend/next.config.ts`
- `apps/frontend/src/app/globals.css`
- `apps/frontend/src/app/layout.tsx`
- `apps/frontend/Dockerfile`

DETAILED IMPLEMENTATION TASKS:
1. `apps/frontend/next.config.ts`:
   - Import `path`: `import path from "path";`
   - Make standalone output conditional and set outputFileTracingRoot:
     ```ts
     output: process.env.BUILD_STANDALONE === "true" || process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
     outputFileTracingRoot: path.join(__dirname, "../../"),
     ```
   - In `experimental`:
     Remove `cpus: 2`.
     Add `turbopackPluginRuntimeStrategy: "workerThreads"`.
2. `apps/frontend/src/app/globals.css`:
   - In `@theme inline`:
     Ensure clean non-circular tokens:
     `--font-sans: var(--font-sans);`
     `--font-mono: var(--font-mono);`
   - In `:root`:
     Declare authentic typography font stacks:
     ```css
     --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
     --font-mono: "DM Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
     ```
3. `apps/frontend/src/app/layout.tsx`:
   - Remove facade dummy objects `const fontSans = { variable: "font-sans" }; const fontMono = { variable: "font-mono" };`.
   - Update `<body>` class to `"font-sans flex h-screen bg-[#F4F5F7] antialiased overflow-hidden"`.
4. `apps/frontend/Dockerfile`:
   - Add `ENV BUILD_STANDALONE=true` before `RUN npm run build -w @nexus-core/frontend` to preserve standalone output during container builds.
5. Clean-State Verification:
   - Clean any lingering build artifacts: `Remove-Item -Recurse -Force apps/frontend/.next -ErrorAction SilentlyContinue`
   - Verify isolated frontend build: `npm run build --prefix apps/frontend` (must exit 0, compile 34/34 routes)
   - Verify cache-busting monorepo build: `npx turbo run build --force` (must exit 0 on 2/2 packages)
   - Verify TypeScript typecheck: `npx tsc --noEmit -p apps/backend/tsconfig.json` and `npx tsc --noEmit -p apps/frontend/tsconfig.json` (exit 0)
   - Verify ESLint: `npm run lint --workspace=@nexus-core/backend` and `npm run lint --workspace=@nexus-core/frontend` (exit 0)
   - Verify unified test suites: `npm test` (must pass 304/304 tests)

OUTPUT:
Write your full handoff report to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m5_2\handoff.md` and notify parent via `send_message`.
