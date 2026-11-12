## 2026-11-10T21:45:13Z
You are m3_spec_miner_2 (teamwork_spec_miner) extracting backend API specifications and data contracts for Milestone 3 of nexus-core.

MANDATORY INPUTS (read these first):
- Original request: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md
- Project scope: c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md
- Milestone 3 scope: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m3\SCOPE.md
- Milestone 2 handoff: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m2\handoff.md

Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
Your state folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\m3_spec_miner_2

MISSION:
Investigate backend controllers, services, DTOs, and schema in:
- `apps/backend/src/tutoria/tutoria.controller.ts`
- `apps/backend/src/tutoria/tutoria.service.ts`
- `apps/backend/src/tutoria/dto/create-intervencao.dto.ts`
- `apps/backend/src/tutoria/dto/transferir-tutor.dto.ts`
- `apps/backend/src/db/schema.ts` (specifically `tutoriaAtendimentosHistorico` and `tutoriaAtendimentosKanban`)

Document the exact specification:
1. Endpoint `GET /api/tutoria/aluno/:matricula/timeline`:
   - URL parameters and query parameters (`atendimentoId`).
   - Expected status codes (200, 401, 403, 404).
   - Complete JSON response structure, field names (camelCase vs snake_case), nullability, enums for `tipoEvento` and `canalContato`, synthetic event generation behavior for legacy records.
2. Endpoint `POST /api/tutoria/intervencoes`:
   - Request body format, required vs optional fields, enum validation constraints.
   - Status codes (201 Created vs 400 Bad Request).
   - Returned response payload structure.
3. Endpoint `GET /api/tutoria/tutores`:
   - Response structure (array of active tutors: id, name, email).
   - Ordering and filtering.

DO NOT IMPLEMENT SOURCE CODE. Write your detailed specification handoff in:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\m3_spec_miner_2\handoff.md`

Update your `progress.md` and send a message back to the parent (conversation ID 5e78f035-a206-421e-9e96-62fa21d6fe12) when done.
