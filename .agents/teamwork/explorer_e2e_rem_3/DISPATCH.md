# DISPATCH — Explorer E2E Remediation 3 (Adversarial Gaps & Invariant Remediation)

## Mission
Analyze Challenger 1's findings on domain invariant gaps in the Baton Pass workflow (`POST /api/tutoria/kanban/:id/transferir`) and formulate the exact test cases and invariant checks required in the genuine backend suite.

## Mandatory Inputs (FULL AUDIT & REVIEW EVIDENCE)
- ORIGINAL_REQUEST.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- TEST_INFRA.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\TEST_INFRA.md`
- Full Auditor Evidence Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\auditor_e2e_1\handoff.md`
- Challenger 1 Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\challenger_e2e_1\handoff.md`
- GATE_STATUS.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_e2e_track\GATE_STATUS.md`

## Working Directory & State Folder
- Working Directory: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
- State Folder: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_3`

## Specific Remediation Plan Required
1. Review Challenger 1's finding on the Baton Pass domain invariant gap:
   - Transferring to an inactive tutor (`isActive === false`) or non-tutor user (`modules` lacking `'tutoria'`) must be rejected.
2. Inspect `TutoriaService.transferirTutor` in `apps/backend/src/tutoria/tutoria.service.ts`:
   - Verify how `targetUserRows[0].isActive` is checked and how active tutor validation operates.
3. Formulate the explicit test case additions:
   - `TC-T2-F5-06`: Reject baton pass targeting an inactive tutor with 400 Bad Request ("Tutor selecionado está inativo.").
   - `TC-T2-F5-07`: Reject baton pass targeting a non-existent user with 404 Not Found.
4. Verify that all 4 tiers of tests in `apps/backend/test/tutoria-multitutor.e2e-spec.ts` will pass cleanly against the genuine `TutoriaController` and `TutoriaService`.
5. Write your detailed remediation handoff report to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_3\handoff.md`.


## 2026-11-10T21:23:35Z
You are Explorer Remediation 3 for the E2E Testing Track of nexus-core.

MANDATORY INPUTS (FULL AUDIT & REVIEW EVIDENCE):
- Read ORIGINAL_REQUEST.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- Read PROJECT.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- Read TEST_INFRA.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\TEST_INFRA.md`
- Read Full Auditor Evidence Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\auditor_e2e_1\handoff.md`
- Read Challenger 1 Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\challenger_e2e_1\handoff.md`
- Read GATE_STATUS.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_e2e_track\GATE_STATUS.md`
- Read DISPATCH.md at: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_3\DISPATCH.md`

Your working directory is: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
Your state folder is: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_3`

TASK:
1. Analyze Challenger 1's empirical invariant finding: transferring attendance ownership to inactive tutors (`isActive: false`) or non-tutor users must be rejected.
2. Inspect `apps/backend/src/tutoria/tutoria.service.ts` (`transferirTutor`) to verify how target tutors are validated.
3. Formulate the explicit test case additions (`TC-T2-F5-06` for inactive tutor rejection, `TC-T2-F5-07` for non-existent tutor rejection) and verify that the genuine backend suite covers all 4 tiers without domain invariant gaps.
4. Write your detailed remediation report to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_3\handoff.md`.
5. Send message to parent sub_orchestrator when done.
