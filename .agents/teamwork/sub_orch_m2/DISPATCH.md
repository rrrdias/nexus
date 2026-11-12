# DISPATCH — Sub-Orchestrator Milestone 2 (Backend Tutoria APIs & Hybrid Ownership)

## Mission
Orchestrate and deliver Milestone 2: Backend Tutoria APIs, Hybrid Multi-Tutor Ownership Logic, Intervention Logging, Baton Passing, and Consolidated Timeline Query.

## Scope & Inputs
- Project scope document: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- Original user request: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- State folder: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m2`
- Working directory: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
- Milestone 1 handoff report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m1\handoff.md` (Schema definitions, relations, types)
- Backend survey report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_survey_1\handoff.md`

## Deliverables
1. **DTOs** in `apps/backend/src/tutoria/dto/`:
   - `create-intervencao.dto.ts` (validation for manual interventions, communications, notes)
   - `transferir-tutor.dto.ts` (validation for baton pass: `novoTutorId: string`, `notaTransicao: string`)
   - `update-kanban-card.dto.ts` or updates to existing DTOs.
2. **Refactor `updateKanbanCard` in `TutoriaService`**:
   - Fix the critical ownership overwrite bug: when an authenticated user moves a card or updates notes, PRESERVE `tutor_responsavel_id` (do NOT overwrite it with caller `tutorId`).
   - Automatically record the action into `tutoria_atendimentos_historico` with `tipoEvento = 'mudanca_status'` (or `'contato_enviado'` / `'nota_pedagogica'`), author snapshot (`autorId`, `autorNome`), previous/new status, and timestamp.
   - Update `ultima_intervencao_em` and increment `qtd_intervencoes` on the card.
3. **New Service Methods & Controller Endpoints**:
   - `POST /api/tutoria/intervencoes`:
     Record manual intervention or communication attempt, link to attendance card if provided or look up by matricula, insert history row, update card metrics.
   - `POST /api/tutoria/kanban/:id/transferir`:
     Execute explicit baton pass: update `tutor_responsavel_id` to `novoTutorId`, record event `passagem_bastao` in `tutoria_atendimentos_historico` with `tutorResponsavelAnteriorId`, `tutorResponsavelNovoId`, and `notaTransicao` in `observacoes`.
   - `GET /api/tutoria/aluno/:matricula/timeline`:
     Retrieve chronological consolidated history of interventions for the student, ordered by `createdAt DESC` (or `ASC`), supporting optional query filter `?atendimentoId=...`. Provide fallback creation event from card `createdAt` if history table has zero rows for legacy cards.
   - `GET /api/tutoria/tutores`:
     Retrieve list of active tutors (`id`, `name`, `email`) for selection in frontend baton pass dialog, protected by `@RequireModule('tutoria')`.
4. **Author Name Resolution**:
   - Resiliently extract tutor name: check `req.user.name` or query `user.name` via `resolveTutorInfo` fallback so audit entries never have null author name when user exists.
5. **Unit Tests**:
   - Update `apps/backend/src/tutoria/tutoria.service.spec.ts` with comprehensive unit tests for all new methods and hybrid ownership behavior.
   - Verify `npm run test -- tutoria.service.spec.ts` passes.

## Iteration Loop
Run Explorer -> Worker -> Reviewer -> Challenger -> Auditor cycle.
Ensure forensic integrity audit passes before approving the milestone.
When complete, write `handoff.md` in your state folder and send a completion message to parent.


## 2026-11-10T21:01:54Z
You are sub_orchestrator for Milestone 2 (Backend Tutoria APIs & Hybrid Ownership) of nexus-core.
Your mission is to orchestrate the implementation and verification of the backend Tutoria APIs, hybrid ownership logic, intervention recording, baton passing, and consolidated student timeline.
Parent conversation ID: 41677f55-1bb4-43a4-8ea4-f075d563de44
