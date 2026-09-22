## 2026-09-18T17:48:00Z

CONTEXT & MISSION:
The independent Victory Auditor flagged specific integrity and acceptance violations that must be remediated:
1. Hardcoded plaintext Lyceum database credentials in apps/backend/inspect_mat.js (user 'PortAeeConsult', password 'Port4eeC0nsult@Tudo.', IP 172.29.44.90).
   ACTION: Delete apps/backend/inspect_mat.js completely from the repository.
2. Spurious files:
   ACTION: Delete the spurious file '=' (0 bytes) at the root of the project (c:\Users\ricardo.dias\develop\projetos\nexus-core\=) and delete the duplicate lockfile apps/frontend/package-lock.json.
3. Fallback JWT secrets:
   In apps/backend/src/auth/auth.module.ts (line 10) and apps/backend/src/auth/jwt-auth.guard.ts (line 44), remove the leaked hardcoded fallback 'nexus-secret-key-2026'. Ensure a fail-fast behavior: if process.env.NODE_ENV === 'production' and !process.env.JWT_SECRET, throw an Error preventing bootstrap. For development/testing environments when JWT_SECRET is not set, provide a clean fallback (e.g. process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET is required in production'); })() : 'nexus-dev-jwt-secret-not-for-production-min32chars')) so that test suites and development continue to function without failing.
4. Academic Sync destructive table wipe:
   In apps/backend/src/academic/academic-sync.service.ts (around line 135), replace the global unbounded `await tx.delete(academicMatricula)` with a scoped deletion that only deletes records for the turmas being processed in the active periods (e.g. where inArray(academicMatricula.turmaId, turmaIds)), so that historical data from previous periods is never wiped.
5. Scheduling route handlers host/port fallback:
   In apps/frontend/src/app/api/scheduling/export/route.ts (line 12) and apps/frontend/src/app/api/scheduling/bookings/route.ts (line 12), replace "http://backend:3001" with "http://localhost:3004" (matching apps/frontend/src/app/actions/api.ts).
6. CI workflow:
   In .github/workflows/ci.yml (line 49), review and fix the lint step so that quality gates are enforced properly.
7. Verification:
   Run:
   - `npm run test --workspace=@nexus-core/backend -- --runInBand`
   - `npm run test:e2e --workspace=@nexus-core/backend`
   - `npm run build`
   Ensure all tests pass 100% and build succeeds without errors.
8. Update AUDIT_REPORT.md:
   Update the executive summary, Section 1.3, Section 4, Section 7, and Section 8 in c:\Users\ricardo.dias\develop\projetos\nexus-core\AUDIT_REPORT.md to document the remediations executed, the new compliance status, and updated scorecard.
