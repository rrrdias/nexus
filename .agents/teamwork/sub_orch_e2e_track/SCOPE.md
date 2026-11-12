# Scope: E2E Testing Track (Multi-Tutor Hybrid Attendance, Timeline & Audit Trail)

## Architecture
- **Target Systems Under Test**:
  - Backend `TutoriaModule` (`apps/backend`): Controllers, Services, DTOs, and Database operations for multi-tutor attendance, audit history logging, baton passing, and chronological timelines.
  - Frontend Server Actions & Utility Layer (`apps/frontend`): Server actions in `apps/frontend/src/app/actions/tutoria.ts` and timeline/kanban utility formatting.
- **Test Strategy & Harness**:
  - Independent, opaque-box, requirement-driven test runners.
  - Isolated NestJS test harness avoiding external dependencies on Redis (BullMQ) or remote SQL Server (Lyceum).
  - Standalone runnable test runner with deterministic mocks/test database, and frontend action test runner using Node/tsx.

## Feature Inventory (E2E Test Coverage)
| # | Feature | Description | Target Milestone | Source |
|---|---------|-------------|------------------|--------|
| 1 | F1: Modelo Híbrido Multi-Tutor | Posse primária fixada; intervenções colaborativas sem roubar titularidade | E2, E3, E4, E5 | ORIGINAL_REQUEST R1 |
| 2 | F2: Trilha de Auditoria Schema | Tabela e entidades de histórico com autor (id/nome), tipo, estados, payload | E2, E3, E4, E5 | ORIGINAL_REQUEST R2 |
| 3 | F3: Auditoria de Mudanças Kanban | Registro automático de transição de status no histórico | E2, E3, E4, E5 | ORIGINAL_REQUEST R2 |
| 4 | F4: Registro de Comunicação | Registro de envios e tentativas de contato via WhatsApp, email, etc. | E2, E3, E4, E5 | ORIGINAL_REQUEST R2 |
| 5 | F5: Passagem de Bastão (Transferência) | Endpoint e fluxo de transferência com nota explicativa e validações | E2, E3, E4, E5 | ORIGINAL_REQUEST R3 |
| 6 | F6: API de Linha do Tempo Consolidada | Consulta cronológica completa de eventos por matrícula de discente | E2, E3, E4, E5 | ORIGINAL_REQUEST R3 |
| 7 | F7: API de Tutores Ativos | Consulta de lista de tutores disponíveis para seleção e transferência | E2, E3, E4, E5 | ORIGINAL_REQUEST R3 |
| 8 | F8: Validação de Ações Frontend | Validação de payloads e contratos de Server Actions em `actions/tutoria.ts` | E2, E3, E4, E5 | ORIGINAL_REQUEST R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E1 | Test Infra & Specification | Create `TEST_INFRA.md` at project root with methodology, runner definitions, directory layout | none | DONE |
| E2 | Tier 1: Feature Coverage Test Suite | ≥5 tests per feature covering all isolated happy paths (≥40 tests) | E1 | BLOCKED: Needs genuine production binding |
| E3 | Tier 2: Boundary & Corner Cases Suite | ≥5 tests per feature covering edge cases, nulls, invalid inputs, unauthorized actions, empty strings, max boundaries (≥40 tests) | E1 | BLOCKED: Needs genuine production binding |
| E4 | Tier 3: Cross-Feature Interactions | Pairwise combinatorial tests for multi-tutor interventions, concurrent status changes, baton pass followed by interventions | E2, E3 | BLOCKED: Needs genuine production binding |
| E5 | Tier 4: Real-World Scenarios | End-to-end multi-tutor pedagogical workflows (student dropout risk recovery, shift changes, multi-channel outreach) | E4 | BLOCKED: Needs genuine production binding |
| E6 | E2E Suite Verification & Publication | Full execution of all tiers, verification by Reviewer/Challenger/Auditor, and publishing `TEST_READY.md` | E2, E3, E4, E5 | BLOCKED: Integrity Violation (auditor_e2e_1) |

## Interface Contracts Under Test
1. `GET /api/tutoria/aluno/:matricula/timeline`
   - Params: `matricula: string`
   - Returns: Chronologically sorted array of event objects.
2. `POST /api/tutoria/intervencoes`
   - Body: `{ matricula, tipoEvento, canalContato, observacoes, statusKanban, metadata }`
   - Returns: 201 Created with persisted event.
3. `POST /api/tutoria/kanban/:id/transferir`
   - Params: `id` (atendimentoId)
   - Body: `{ novoTutorId, notaTransicao }`
   - Returns: 200 OK `{ success: true, card, evento }`
4. `GET /api/tutoria/tutores`
   - Returns: 200 OK list of active tutors `{ id, name, email }`
5. `PATCH /api/tutoria/kanban/:id`
   - Body: `{ statusKanban, observacoes, ... }`
   - Verifies: `tutor_responsavel_id` is untouched; historical event is appended.
