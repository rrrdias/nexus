# Task Assignment: Challenger 1 (Milestone 4 - Frontend Kanban Multi-Tutor & Baton Pass UI)

## Objective
Empirically challenge and stress-test the Milestone 4 implementation:
- `apps/frontend/src/components/tutoria/BatonPassDialog.tsx`
- `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx`
- `apps/frontend/src/lib/tutoria-utils.ts`
- `apps/frontend/src/lib/tutoria-kanban-m4.test.ts`

## Mandatory Inputs to Read
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m4\SCOPE.md`
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m4_1\handoff.md`

## Challenge Focus
1. **Adversarial Input Validation for BatonPassDialog**:
   - Empty/whitespace notes, note lengths at boundary (4 chars vs 5 chars, 10,000 chars, special characters, unicode, emojis, SQL injection attempts, XSS payloads).
   - Self-transfer attempts (same ID, null IDs, invalid UUIDs).
   - Simulating network failures and retry flows in Base UI modal dialog.
2. **Empirical Verification of F10 & F11**:
   - Stress test `getLeadTutorInfo` across 1,000 synthetic card permutations (null cards, missing session users, case variations, whitespace padding).
   - Stress test `checkRecentIntervention` across time boundary values: exactly 48h, 48h + 1ms, 48h - 1ms, negative time (clock skew), future anomalies (> 1h), epoch 0, malformed dates.
3. **Execution**:
   - Write a dedicated adversarial/stress test script or execute empirical harnesses to verify behavior under extreme loads.
   - Run: `npx tsc --noEmit -p apps/frontend/tsconfig.json` and your test suite.

## Output Requirement
Write your handoff report to:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\challenger_m4_1\handoff.md`
State clearly your verdict: **APPROVE** or **REQUEST_CHANGES**.
Notify parent when complete.
