# Dispatch Assignments

## 2026-11-11T00:55:49Z
Sender: 774132d6-ef2e-4f08-97f9-3176a183edaf (Parent Orchestrator)
Mission: Sub-Orchestrator for Milestone 4 (Frontend Kanban Multi-Tutor & Baton Pass UI)

Features:
- F10: Badge de Tutor Responsável no Kanban: Render primary lead tutor on every Kanban card in TutoriaKanbanClient.tsx.
- F11: Indicador de Intervenção Recente: Visual pulse badge/indicator on cards with activity within the last 48 hours.
- F12: Modal de Passagem de Bastão: Create apps/frontend/src/components/tutoria/BatonPassDialog.tsx allowing tutor transfer with mandatory note (>= 5 chars) via transferirTutoriaBastao.
- F13: Movimentação Kanban Preservando Posse: Ensure drag-and-drop and column transitions preserve primary tutor ownership while recording audit history with acting tutor's credentials.

ITERATION LOOP PROCEDURE:
1. Phase 1 (Exploration):
   - Spawn 3 Explorers (e.g. 2 Explorers + 1 Spec Miner) in parallel to investigate TutoriaKanbanClient.tsx, card data structure, drag-and-drop handling, existing dialogs/modals, and baton pass integration points. Wait for their reports.
2. Phase 2 (Implementation):
   - Spawn teamwork_worker to implement BatonPassDialog.tsx and update TutoriaKanbanClient.tsx according to explorer findings. Worker must verify TypeScript compilation (npx tsc --noEmit -p apps/frontend/tsconfig.json) and run tests.
   - Worker dispatch MUST include MANDATORY INTEGRITY WARNING: "DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected."
3. Phase 3 (Review):
   - Spawn 2 teamwork_reviewer agents in parallel to review code quality, UX correctness, layout compliance, and run tests.
4. Phase 4 (Empirical Challenge):
   - Spawn 2 teamwork_challenger agents in parallel to create stress tests, boundary tests, and verify behavior empirically.
5. Phase 5 (Forensic Audit):
   - Spawn 1 teamwork_auditor to execute forensic integrity checks.
6. Phase 6 (Gate):
   - Update GATE_STATUS.md. All must PASS, Auditor has binary veto.
7. Phase 7 (Handoff):
   - Write handoff.md in your state folder and report completion back to parent via send_message.
