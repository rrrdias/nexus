# DISPATCH — Explorer E2E Remediation 1 (Backend Genuine Harness Design)

## Mission
Analyze the full Forensic Audit failure report, Reviewer 1 report, and Challenger 1 report. Design the strategy to eliminate the in-test facade controller and bind `apps/backend/test/tutoria-multitutor.e2e-spec.ts` directly to the production `TutoriaController` and `TutoriaService`.

## Mandatory Inputs (FULL AUDIT & REVIEW EVIDENCE)
- ORIGINAL_REQUEST.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- TEST_INFRA.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\TEST_INFRA.md`
- Full Auditor Evidence Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\auditor_e2e_1\handoff.md`
- Reviewer 1 Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\reviewer_e2e_1\handoff.md`
- Challenger 1 Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\challenger_e2e_1\handoff.md`
- GATE_STATUS.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_e2e_track\GATE_STATUS.md`

## Working Directory & State Folder
- Working Directory: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
- State Folder: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_1`

## Specific Remediation Plan Required
1. Read the auditor's full evidence report and review findings. Note the core violation: `TutoriaMultiTutorE2EController` (lines 498-887 in `tutoria-multitutor.e2e-spec.ts`) was an in-test facade bypassing `TutoriaController` and `TutoriaService`.
2. Inspect `apps/backend/src/tutoria/tutoria.controller.ts` and `apps/backend/src/tutoria/tutoria.service.ts` to examine the genuine methods delivered by Milestone M2 (`getActiveTutors`, `getStudentTimeline`, `createIntervencao`, `transferirTutor`, `updateKanbanCard`, `createKanbanCard`).
3. Formulate the concrete fix strategy for `tutoria-multitutor.e2e-spec.ts`:
   - Remove `TutoriaMultiTutorE2EController` entirely.
   - Set `controllers: [TutoriaController]` in `Test.createTestingModule`.
   - Update `createMockTutoriaDatabase().execute` to match the exact SQL queries executed by `TutoriaService` (e.g., `SELECT ... FROM tutoria_atendimentos_kanban`, `UPDATE tutoria_atendimentos_kanban`, `INSERT INTO tutoria_atendimentos_historico`, `SELECT ... FROM tutoria_atendimentos_historico`, `SELECT ... FROM "user"`).
4. Write your detailed remediation handoff report to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_1\handoff.md`.
