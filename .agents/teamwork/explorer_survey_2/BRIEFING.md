# BRIEFING — 2026-11-10T20:25:00Z

## Mission
Survey and analyze the frontend codebase (`apps/frontend`) for multi-tutor support, hybrid ownership, attendance timeline, and audit trail in the NexusHub Tutoria module.

## 🔒 My Identity
- Archetype: explorer
- Roles: Frontend UI/UX Explorer
- Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
- State folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_survey_2
- Original parent: 41677f55-1bb4-43a4-8ea4-f075d563de44
- Milestone: Multi-Tutor and Timeline Frontend Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Must follow Handoff Protocol (5 components: Observation, Logic Chain, Caveats, Conclusion, Verification Method)
- Provide concrete component paths, line numbers, props interfaces, and state flow

## Current Parent
- Conversation ID: 41677f55-1bb4-43a4-8ea4-f075d563de44
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `apps/frontend/src/app/tutoria/page.tsx`
  - `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx`
  - `apps/frontend/src/app/tutoria/kanban/page.tsx`
  - `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx`
  - `apps/frontend/src/app/actions/tutoria.ts`
  - `apps/frontend/src/app/actions/api.ts`
  - `apps/frontend/src/auth.ts`
  - `apps/frontend/src/components/ui/` (`dialog.tsx`, `avatar.tsx`, `badge.tsx`, `button.tsx`, etc.)
  - `apps/frontend/src/components/SidebarClient.tsx`
  - Backend integration points: `apps/backend/src/tutoria/tutoria.controller.ts`, `tutoria.service.ts`, `jwt-auth.guard.ts`
- **Key findings**:
  - Auth context: `sessionUser = { id, name, email, isSuperAdmin }` is already passed to both `TutoriaDashboard` and `TutoriaKanbanClient`.
  - Backend automatically extracts `req.user.id` from the Bearer token sent by `fetchFromApi`.
  - Currently in `TutoriaDashboard.tsx`, Tab 3 ("Histórico & Tutoria") lacks a chronological timeline and intervention logger.
  - Currently in `TutoriaKanbanClient.tsx`, cards do not display primary tutor name or recent intervention badge.
  - Moving kanban cards in `TutoriaKanbanClient.tsx` currently calls `updateTutoriaKanbanCard` which backend inadvertently uses to overwrite `tutor_responsavel_id` on any update.
  - Need a new endpoint in `TutoriaModule` (`/api/tutoria/tutores`) to fetch active tutors for baton pass without requiring `@RequireAdmin()`.
  - Typecheck (`npx tsc --noEmit --project apps/frontend/tsconfig.json`) currently passes with zero errors.
- **Unexplored areas**: None for frontend scope.

## Key Decisions Made
- Formulated modular architecture: dedicated `TutoriaTimeline.tsx` and `BatonPassDialog.tsx` components with rich visual status, badges, avatars, and responsive layout.
- Proposed clean Server Actions contract in `apps/frontend/src/app/actions/tutoria.ts`.

## Artifact Index
- `.agents/teamwork/explorer_survey_2/handoff.md` — Comprehensive frontend survey and architectural specification.
