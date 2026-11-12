# Task Assignment: Reviewer 1 (Milestone 4 - Frontend Kanban Multi-Tutor & Baton Pass UI)

## Objective
Independently review the Milestone 4 implementation of:
- `apps/frontend/src/components/tutoria/BatonPassDialog.tsx` (F12)
- `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx` (F10, F11, F12, F13)
- `apps/frontend/src/lib/tutoria-utils.ts`
- `apps/frontend/src/lib/tutoria-kanban-m4.test.ts`

## Mandatory Inputs to Read
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m4\SCOPE.md`
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m4_1\handoff.md`

## Review Focus & Criteria
1. **F10 Correctness**: Lead tutor badge rendered on all cards ("Você (Titular)" indigo vs peer slate vs "Sem tutor" amber dashed).
2. **F11 Correctness**: Recent intervention indicator (emerald pulsing ping `<48h` and count chip) for activity within 48h.
3. **F12 Correctness & Robustness**: `BatonPassDialog.tsx` Base UI integration, selection validation, non-self transfer, note length validation (>= 5 chars), character counter, error banner, and server action dispatch (`transferirTutoriaBastao`).
4. **F13 Correctness**: Kanban card moves (drag-and-drop and chevron) preserve `tutor_responsavel_id`.
5. **Code Quality & Type Safety**: Run `npx tsc --noEmit -p apps/frontend/tsconfig.json` and run tests `npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-kanban-m4.test.ts`.

## Output Requirement
Write your handoff report to:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\reviewer_m4_1\handoff.md`
State clearly your verdict: **APPROVE** or **REQUEST_CHANGES**.
Notify parent when complete.


## 2026-11-11T01:24:29Z
You are Reviewer 1 for Milestone 4 (Frontend Kanban Multi-Tutor & Baton Pass UI).
Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
State folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\reviewer_m4_1

MANDATORY INPUTS TO READ:
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m4\SCOPE.md
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\reviewer_m4_1\DISPATCH.md
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m4_1\handoff.md

YOUR MISSION:
Review the Milestone 4 frontend code changes in:
- apps/frontend/src/components/tutoria/BatonPassDialog.tsx
- apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx
- apps/frontend/src/lib/tutoria-utils.ts
- apps/frontend/src/lib/tutoria-kanban-m4.test.ts

Verify:
1. F10: Lead tutor badge rendered on cards ("Você (Titular)" vs peer vs "Sem tutor").
2. F11: Recent intervention pulse indicator (<48h) and count chip.
3. F12: BatonPassDialog modal, validation (target tutor, note >= 5 chars, non-self transfer), character counter, server action dispatch.
4. F13: Movimentação Kanban preservando posse (drag-and-drop and column transitions preserve primary tutor).
5. Run verification commands:
   - npx tsc --noEmit -p apps/frontend/tsconfig.json
   - npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-kanban-m4.test.ts
   - npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts

State clearly your verdict (APPROVE or REQUEST_CHANGES) in:
c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\reviewer_m4_1\handoff.md
Send message to parent when done.
