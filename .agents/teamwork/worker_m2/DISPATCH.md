## 2026-11-10T21:14:32Z
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You are Worker M2 for Milestone 2 (Backend Tutoria APIs & Hybrid Ownership).
Your state folder is: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\worker_m2
Your working directory is: c:\Users\ricardo.dias\develop\projetos\nexus-core

First, read the context and blueprint documents:
1. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
2. `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
3. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m2\SCOPE.md`
4. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m2\DISPATCH.md`
5. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m2_1\handoff.md` (detailed service recipes & hybrid model)
6. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m2_2\handoff.md` (controller & DTO specifications)
7. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m2_3\handoff.md` (unit testing specifications & mock DB architecture)

Your exclusive write ownership is strictly limited to:
- `apps/backend/src/tutoria/dto/create-intervencao.dto.ts`
- `apps/backend/src/tutoria/dto/transferir-tutor.dto.ts`
- `apps/backend/src/tutoria/dto/update-kanban-card.dto.ts`
- `apps/backend/src/tutoria/tutoria.controller.ts`
- `apps/backend/src/tutoria/tutoria.service.ts`
- `apps/backend/src/tutoria/tutoria.service.spec.ts`

Your deliverables:
1. **DTOs**:
   - Create `apps/backend/src/tutoria/dto/create-intervencao.dto.ts` with class-validator decorators.
   - Create `apps/backend/src/tutoria/dto/transferir-tutor.dto.ts` with class-validator decorators.
   - Verify/update `apps/backend/src/tutoria/dto/update-kanban-card.dto.ts` if needed.
2. **`TutoriaService` in `apps/backend/src/tutoria/tutoria.service.ts`**:
   - Add `resolveTutorInfo(userId)` with in-memory TTL caching querying `"user"` table.
   - Refactor `updateKanbanCard`: Remove the ownership overwrite bug! Do NOT mutate `tutor_responsavel_id` on card updates. Record audit events into `tutoria_atendimentos_historico` (`mudanca_status`, `intervencao_manual`, `contato_enviado`) with `autorId` and `autorNome`. Update `ultima_intervencao_em` and increment `qtd_intervencoes`.
   - Implement `registrarIntervencao`: validate inputs, find/link card by `atendimentoId` or `matricula`, update card metrics, insert event into `tutoria_atendimentos_historico`, return inserted event.
   - Implement `transferirTutor`: validate card exists, validate target tutor exists and is active, reject if target is already owner or note is too short (<5 chars), update card `tutor_responsavel_id = novoTutorId`, update card metrics, insert `passagem_bastao` event into `tutoria_atendimentos_historico`, return `{ success: true, card, evento }`.
   - Implement `getTimelineAluno`: query `tutoria_atendimentos_historico` ordered by `createdAt ASC`, support optional `atendimentoId` filter, provide fallback legacy card creation event if 0 history events.
   - Implement `getTutoresAtivos`: query active users (`id`, `name`, `email`) from `"user"` where `"isActive" = true` ordered by `name ASC`.
3. **`TutoriaController` in `apps/backend/src/tutoria/tutoria.controller.ts`**:
   - `GET api/tutoria/tutores` -> `getTutoresAtivos()`
   - `POST api/tutoria/intervencoes` (`@HttpCode(HttpStatus.CREATED)`) -> `registrarIntervencao`
   - `POST api/tutoria/kanban/:id/transferir` (`@HttpCode(HttpStatus.OK)`) -> `transferirTutor`
   - `GET api/tutoria/aluno/:matricula/timeline` -> `getTimelineAluno`
   - `PATCH api/tutoria/kanban/:id` -> pass `req.user?.id` and `req.user?.name` to `updateKanbanCard`
4. **Unit Tests in `apps/backend/src/tutoria/tutoria.service.spec.ts`**:
   - Implement the Universal Mock DB architecture designed in Explorer 3's handoff (thenable query builder + SQL router).
   - Implement tests covering all 6 functional groups (card update ownership preservation, audit history logging, metrics bumping, interventions, baton pass, timeline ordering & legacy fallback, active tutors, error cases).
   - Ensure all existing tests pass and all new tests pass.
5. **Run Verification Commands**:
   - `npm run test --prefix apps/backend -- tutoria.service.spec.ts`
   - `npx tsc --noEmit -p apps/backend/tsconfig.json`
   - `npm run build --prefix apps/backend`
   - `npm run test --prefix apps/backend -- tutoria-multitutor.e2e-spec.ts` (if applicable)


## 2026-11-10T21:25:07Z
**Context**: Milestone 2 Worker Implementation
**Content**: Checking in on your progress. We see you have implemented the DTOs, service methods, controller routes, and unit tests. Are you currently running tests or finalizing the handoff report?
**Action**: Please report current status or finalize your handoff report in `worker_m2/handoff.md`.
