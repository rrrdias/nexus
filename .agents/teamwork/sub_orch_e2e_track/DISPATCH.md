# DISPATCH — E2E Testing Orchestrator

## Mission
Design, implement, and verify the comprehensive, requirement-driven, opaque-box E2E Test Suite for the Multi-Tutor Hybrid Attendance, Timeline, and Audit Trail system in NexusHub Tutoria.

## Context & Scope
- Project scope document: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- Original user request: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- State folder: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_e2e_track`
- Working directory: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
- Survey report on test infra: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_survey_3\handoff.md`

## Architecture & Responsibilities
- Create `TEST_INFRA.md` at project root defining the 4-tier methodology (Category-Partition, Boundary Value Analysis, Pairwise Combinations, Real-World Scenarios).
- Implement the isolated test runner and test cases for `TutoriaModule` (`apps/backend/test/tutoria.e2e-spec.ts` or standalone runner) and any frontend action verifications (`apps/frontend/src/lib/tutoria-e2e.test.ts` runnable via tsx or node).
- Coverage Requirements:
  - Tier 1: Feature Coverage (>=5 per feature)
  - Tier 2: Boundary & Corner Cases (>=5 per feature)
  - Tier 3: Cross-Feature Interactions & Combinations (pairwise)
  - Tier 4: Real-World Multi-Tutor Application Scenarios
- When test suite creation and initial verification are complete, publish `TEST_READY.md` at project root following the format in `PROJECT.md`.
- Coordinate the Explorer -> Worker -> Reviewer -> Challenger -> Auditor cycle as required.

## Completion Signal
Publish `TEST_READY.md` at project root and send a completion message with summary to parent.


## 2026-11-10T20:28:52Z
You are sub_orchestrator for the E2E Testing Track of nexus-core.
Your mission is to design, implement, and verify the comprehensive, requirement-driven, opaque-box E2E test suite for Multi-Tutor Hybrid Attendance, Timeline, and Audit Trail.

Read your full dispatch instructions at:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_e2e_track\DISPATCH.md`
And the project definition at:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
And the original request at:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`

Your working directory is:
`c:\Users\ricardo.dias\develop\projetos\nexus-core`
Your state folder is:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_e2e_track`

Create `TEST_INFRA.md` at project root, dispatch workers/test writers for test suites (Tiers 1-4), verify them, and publish `TEST_READY.md` at project root upon completion.
Report your progress in your state folder's `progress.md` and send a message back to the parent orchestrator (conversation ID 41677f55-1bb4-43a4-8ea4-f075d563de44) when complete.
