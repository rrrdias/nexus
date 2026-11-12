# Task Assignment: Worker 1 (Frontend Kanban Multi-Tutor & Baton Pass UI)

## Objective
Implement `apps/frontend/src/components/tutoria/BatonPassDialog.tsx` (F12) and update `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx` (F10, F11, F12 integration, F13).

## Mandatory Inputs to Read
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m4\SCOPE.md`
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m4_1\handoff.md` (Badge & Pulse Specs)
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\spec_miner_m4_1\handoff.md` (BatonPassDialog Specs)
- `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m4_2\handoff.md` (DnD, Ownership Invariants & Integration)
- `apps/frontend/src/app/actions/tutoria.ts`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Tasks
1. Create `apps/frontend/src/components/tutoria/BatonPassDialog.tsx`:
   - Implement Base UI / Tailwind modal dialog conforming to the blueprint in `spec_miner_m4_1/handoff.md`.
   - Props: `cardId`, `matricula`, `alunoNome`, `currentTutorId`, `currentTutorNome`, `disciplinaNome`, `trigger`, `open`, `onOpenChange`, `initialTutors`, `onSuccess`, `onCancel`.
   - Fetch active tutors via `getTutoriaTutores()` or use `initialTutors`.
   - Select dropdown for choosing the new lead tutor (disabling current tutor option).
   - Textarea for mandatory transition note with real-time character counter (`>= 5 chars`).
   - Validation preventing submission if tutor is missing or same as current tutor, or if note has `< 5` characters.
   - Dispatch `transferirTutoriaBastao(cardId, { novoTutorId, notaTransicao })`.
   - Error banner on API failure and loading spinner during submission.

2. Update `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx`:
   - Add helpers `getLeadTutorInfo` and `checkRecentIntervention` as specified in `explorer_m4_1/handoff.md`.
   - In each card JSX:
     - Render F10 Lead Tutor Badge: "Você (Titular)" (indigo) if `card.tutor_responsavel_id === sessionUser?.id`, peer tutor name (slate) if assigned, or "Sem tutor" (amber dashed) if unassigned.
     - Render F11 Recent Intervention Indicator: emerald pulsing indicator (`animate-ping` + solid dot) with `<48h` and count chip if intervention/contact happened within the last 48 hours.
     - Add F12 Baton Pass trigger button on card footer (with `e.stopPropagation()`) and inside the Card Edit Modal (`selectedCard`).
   - Mount `<BatonPassDialog>` at the bottom of the component, updating card state optimistically and refreshing via `fetchKanban()` upon success.
   - Ensure F13: column transitions and drag-and-drop preserve `tutor_responsavel_id` and `tutor_nome` without resetting ownership.

3. Verify:
   - TypeScript compilation: `npx tsc --noEmit -p apps/frontend/tsconfig.json` must pass with 0 errors.
   - Run tests: `npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts`, `npx tsx apps/frontend/src/lib/tutoria-adversarial.test.ts`, and `npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-empirical-challenge.test.ts`.
   - If appropriate, add unit/integration assertions for BatonPassDialog and Kanban cards.

## Output Requirement
Write your complete report to:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m4_1\handoff.md`
Report verification commands and results, then send a message to parent.


## 2026-11-11T01:06:17Z
[Message] timestamp=2026-11-11T01:06:17Z sender=bbdce847-0504-4650-953c-f8176a495fb1 priority=MESSAGE_PRIORITY_HIGH content=You are Worker 1 for Milestone 4 (Frontend Kanban Multi-Tutor & Baton Pass UI).
Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
State folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m4_1

MANDATORY INPUTS TO READ:
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m4\SCOPE.md
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m4_1\DISPATCH.md
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m4_1\handoff.md
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\spec_miner_m4_1\handoff.md
- c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m4_2\handoff.md
- apps/frontend/src/app/actions/tutoria.ts


## 2026-11-11T01:20:29Z
[Message] timestamp=2026-11-11T01:20:29Z sender=bbdce847-0504-4650-953c-f8176a495fb1 priority=MESSAGE_PRIORITY_HIGH content=**Context**: Milestone 4 Implementation
**Content**: Heartbeat status check on Worker 1 implementation of BatonPassDialog.tsx and TutoriaKanbanClient.tsx updates.
**Action**: Please report your current step, any roadblocks encountered, or estimated completion time.
