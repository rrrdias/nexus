# Scope: Milestone 2 — Backend Tutoria APIs & Hybrid Ownership

## Architecture
- Backend: NestJS 10 (`TutoriaModule`), Drizzle ORM, PostgreSQL.
- Hybrid Multi-Tutor Ownership Model:
  - Attendance cards maintain `tutorResponsavelId` as lead owner.
  - Interventions, column moves, communication notes do NOT overwrite `tutorResponsavelId`.
  - Author snapshot (`autorId`, `autorNome`) is recorded in `tutoria_atendimentos_historico`.
  - Baton pass (`POST /api/tutoria/kanban/:id/transferir`) explicitly updates `tutorResponsavelId` and records `passagem_bastao` event with previous/new tutor and transition notes.
  - Consolidated timeline query (`GET /api/tutoria/aluno/:matricula/timeline`) returns chronologically ordered history.
  - Active tutors query (`GET /api/tutoria/tutores`) returns active tutors for baton pass selection.
  - DTOs ensure validation for interventions and baton transfers.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F1 | Modelo Híbrido Multi-Tutor: Preservar `tutorResponsavelId` em atualizações e intervenções | M2 | PROJECT.md, R1 |
| 3 | F3 | Auditoria de Mudanças Kanban: Gravar histórico em transições de coluna com autor snapshot | M2 | PROJECT.md, R2 |
| 4 | F4 | Registro de Comunicação & Intervenção: Endpoint `POST /api/tutoria/intervencoes` | M2 | PROJECT.md, R2, R3 |
| 5 | F5 | Passagem de Bastão (Backend): Endpoint `POST /api/tutoria/kanban/:id/transferir` | M2 | PROJECT.md, R2, R3 |
| 6 | F6 | API de Linha do Tempo Consolidada: Endpoint `GET /api/tutoria/aluno/:matricula/timeline` | M2 | PROJECT.md, R3 |
| 7 | F7 | API de Tutores Ativos: Endpoint `GET /api/tutoria/tutores` | M2 | PROJECT.md, R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M2 | Backend Tutoria APIs & Hybrid Ownership | DTOs, TutoriaService refactor, TutoriaController endpoints, unit tests | M1 | DONE |

## Interface Contracts
### Endpoints
1. `GET /api/tutoria/aluno/:matricula/timeline?atendimentoId=...` (200 OK)
2. `POST /api/tutoria/intervencoes` (201 Created)
3. `POST /api/tutoria/kanban/:id/transferir` (200 OK)
4. `GET /api/tutoria/tutores` (200 OK)
5. `PATCH /api/tutoria/kanban/:id` (200 OK, preserves owner, logs history)

## Code Layout
- `apps/backend/src/tutoria/dto/create-intervencao.dto.ts`
- `apps/backend/src/tutoria/dto/transferir-tutor.dto.ts`
- `apps/backend/src/tutoria/dto/update-kanban-card.dto.ts`
- `apps/backend/src/tutoria/tutoria.controller.ts`
- `apps/backend/src/tutoria/tutoria.service.ts`
- `apps/backend/src/tutoria/tutoria.service.spec.ts`
