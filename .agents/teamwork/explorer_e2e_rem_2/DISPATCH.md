# DISPATCH — Explorer E2E Remediation 2 (Frontend Genuine Actions & Utilities Design)

## Mission
Analyze the full Forensic Audit failure report regarding `apps/frontend/src/lib/tutoria-e2e.test.ts`. Design the remediation strategy so that the frontend test suite tests production files (`actions/tutoria.ts` and `lib/tutoria-utils.ts`) with ZERO in-test fallbacks.

## Mandatory Inputs (FULL AUDIT & REVIEW EVIDENCE)
- ORIGINAL_REQUEST.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- PROJECT.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- TEST_INFRA.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\TEST_INFRA.md`
- Full Auditor Evidence Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\auditor_e2e_1\handoff.md`
- Reviewer 2 Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\reviewer_e2e_2\handoff.md`
- Challenger 2 Report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\challenger_e2e_2\handoff.md`
- GATE_STATUS.md: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_e2e_track\GATE_STATUS.md`

## Working Directory & State Folder
- Working Directory: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
- State Folder: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_2`

## Specific Remediation Plan Required
1. Review the auditor's finding on `apps/frontend/src/lib/tutoria-e2e.test.ts`: 12 out of 16 tests executed fallback mock functions and in-test utilities because `tutoria-utils.ts` did not exist and `actions/tutoria.ts` lacked the multi-tutor Server Actions.
2. Inspect `apps/frontend/src/app/actions/tutoria.ts` and plan the genuine Server Actions:
   - `getTutoriaTimeline(matricula, atendimentoId)`
   - `createTutoriaIntervencao(data)`
   - `transferirTutoriaBastao(id, data)`
   - `getTutoresAtivos()`
3. Plan the creation of `apps/frontend/src/lib/tutoria-utils.ts` containing:
   - `formatTimelineEventDate(isoDate: string): string`
   - `groupTimelineEventsByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]>`
   - `getAuthorBadge(event: TimelineEvent, currentUserId: string, tutorResponsavelId?: string | null)`
   - `validateBatonPassInput(novoTutorId: string, currentTutorId: string | null | undefined, notaTransicao: string)`
4. Refactor `apps/frontend/src/lib/tutoria-e2e.test.ts` to import directly from `actions/tutoria.ts` and `lib/tutoria-utils.ts` without any in-test fallbacks or in-test duplicate utility definitions.
5. Write your detailed remediation handoff report to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_e2e_rem_2\handoff.md`.
