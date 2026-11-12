## 2026-11-10T21:03:37Z

You are Explorer 2 for Milestone 2 (Backend Tutoria APIs & Hybrid Ownership).
Your state folder is: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m2_2
Your working directory is: c:\Users\ricardo.dias\develop\projetos\nexus-core

First, read:
1. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
2. `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
3. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m2\SCOPE.md`
4. `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m2\DISPATCH.md`
5. `apps/backend/src/tutoria/tutoria.controller.ts`
6. `apps/backend/src/tutoria/dto/` (existing DTOs)
7. `apps/backend/src/auth/` (guards, decorators, current user extraction)

Your mission:
Investigate `TutoriaController` and DTO design in `apps/backend/src/tutoria/`:
1. Inspect guards, decorators (`@UseGuards(JwtAuthGuard)`, `@RequireModule('tutoria')`), how `req.user` is extracted (`req.user?.id`, `req.user?.name`, `req.user?.sub`, etc.) across existing controllers.
2. Inspect existing DTOs in `apps/backend/src/tutoria/dto/` and validation patterns (`class-validator`, `class-transformer`).
3. Design `CreateIntervencaoDto` in `create-intervencao.dto.ts` with validation decorators for all required fields: `atendimentoId` (optional), `matricula` (required string), `periodo` (optional string), `tipoEvento` (IsIn: 'intervencao_manual', 'contato_enviado', etc.), `canalContato` (IsIn: 'whatsapp', 'email', 'telefone', 'ava', 'outro', optional), `observacoes` (required string), `statusKanban` (optional string), `metadata` (optional object).
4. Design `TransferirTutorDto` in `transferir-tutor.dto.ts` with validation (`novoTutorId: IsString / IsNotEmpty`, `notaTransicao: IsString, IsNotEmpty`).
5. Design controller route definitions and decorators:
   - `POST /api/tutoria/intervencoes`
   - `POST /api/tutoria/kanban/:id/transferir`
   - `GET /api/tutoria/aluno/:matricula/timeline`
   - `GET /api/tutoria/tutores`
   - `PATCH /api/tutoria/kanban/:id` updates if needed.
6. Verify status codes, error handling (NotFoundException, BadRequestException, ForbiddenException), and DTO exports.

Do NOT modify any code. Write your full analysis and implementation recommendations to `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m2_2\handoff.md` and send a message when complete.
