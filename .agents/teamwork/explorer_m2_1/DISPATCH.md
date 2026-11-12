## 2026-11-10T21:03:30Z
You are Explorer 1 for Milestone 2 (Backend Tutoria APIs & Hybrid Ownership).
Your state folder is: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m2_1
Your working directory is: c:\Users\ricardo.dias\develop\projetos\nexus-core

First, read:
1. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
2. `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
3. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m2\SCOPE.md`
4. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m2\DISPATCH.md`
5. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m1\handoff.md`
6. `apps/backend/src/tutoria/tutoria.service.ts`
7. `apps/backend/src/db/schema.ts`

Your mission:
Investigate `TutoriaService` in `apps/backend/src/tutoria/tutoria.service.ts` and formulate the implementation strategy for the hybrid ownership model, intervention recording, baton passing, consolidated timeline, and active tutors query:
1. Analyze `updateKanbanCard`: locate the ownership overwrite bug (`tutorId` passed in and overwriting `tutor_responsavel_id` or similar). Determine exact changes needed so `tutorResponsavelId` is preserved on regular card moves/notes, while author snapshot (`autorId`, `autorNome`) is recorded.
2. Determine how to implement `registrarIntervencao`: accepting `atendimentoId`, `matricula`, `periodo`, `tipoEvento`, `canalContato`, `observacoes`, `statusKanban`, `metadata`, `autorId`, `autorNome`. Card lookup/upsert logic if `atendimentoId` is not provided. Updating card metrics (`ultimaIntervencaoEm = new Date()`, `qtdIntervencoes = sql\`${tutoriaAtendimentosKanban.qtdIntervencoes} + 1\``). Inserting into `tutoriaAtendimentosHistorico`.
3. Determine how to implement `transferirTutor`: verifying card exists, verifying new tutor exists, updating `tutorResponsavelId = novoTutorId`, inserting history event `tipoEvento = 'passagem_bastao'` with `tutorResponsavelAnteriorId`, `tutorResponsavelNovoId`, `observacoes = notaTransicao`, `autorId`, `autorNome`.
4. Determine how to implement `getTimelineAluno`: querying `tutoriaAtendimentosHistorico` where `matricula = :matricula`, optionally filtering by `atendimentoId`, ordering by `createdAt DESC` (or ASC per spec, with fallback card creation event if 0 history events exist).
5. Determine how to implement `getTutoresAtivos`: querying `users` table for active users with role/permission or tutoria module access, returning `id`, `name`, `email`. Check schema for `users` and roles/permissions.
6. Determine author name resolution fallback (`resolveTutorInfo` or lookup in `users` table if `req.user.name` is missing).

Do NOT modify any code. Write your full analysis and implementation recommendations to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m2_1\handoff.md` and send a message when complete.
