# Project: Multi-Tutor Hybrid Attendance, Timeline & Audit Trail (NexusHub Tutoria)

## Architecture
- **Monorepo**: Turborepo with workspaces `apps/backend` (NestJS 10, Drizzle ORM, PostgreSQL) and `apps/frontend` (Next.js 16, React 19, Tailwind CSS v4, Base UI, Lucide icons).
- **Core Paradigm — Hybrid Multi-Tutor Attendance**:
  - Each discente attendance card maintains an assigned primary lead tutor (`tutorResponsavelId`).
  - Any authorized tutor can collaborate, move cards, record communications (WhatsApp/e-mail/AVA), or submit pedagogical intervention notes.
  - Collaborator actions NEVER overwrite primary ownership (`tutorResponsavelId`).
  - Transfer of primary ownership occurs exclusively through an explicit "Passagem de Bastão" (baton pass) workflow requiring a target tutor and explanatory transition note.
- **Audit Trail & Timeline Architecture**:
  - Dedicated table `tutoria_atendimentos_historico` stores all lifecycle events (`abertura`, `mudanca_status`, `contato_enviado`, `intervencao_manual`, `passagem_bastao`, `finalizacao`, `reabertura`).
  - Denormalized author snapshot (`autorNome`, `autorId`) alongside foreign keys ensures immutable audit history even if user profiles change.
  - Chronological indexes optimize per-student and per-attendance timeline queries.
- **Frontend Architecture**:
  - Modular UI components in `apps/frontend/src/components/tutoria/`:
    - `TutoriaTimeline.tsx`: Chronological vertical timeline with event-specific badges, icons, author indicators ("Você" vs primary vs collaborator), and formatted timestamps.
    - `TutoriaInterventionForm.tsx`: Direct intervention logging with channel selection.
    - `BatonPassDialog.tsx`: Modal for selecting a new primary tutor with mandatory pedagogical transition notes.
  - Server Actions in `apps/frontend/src/app/actions/tutoria.ts` route JWT-authenticated requests to backend endpoints via `fetchFromApi`.
  - Kanban board cards in `TutoriaKanbanClient.tsx` reflect primary tutor ownership and recent intervention indicators (pulse badge).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F1: Modelo Híbrido Multi-Tutor | Posse primária fixada; intervenções colaborativas sem roubar titularidade | M2 | R1 |
| 2 | F2: Trilha de Auditoria Schema Drizzle | Tabela `tutoria_atendimentos_historico` com FKs, índices e campos de auditoria | M1 | R2 |
| 3 | F3: Auditoria de Mudanças Kanban | Registro automático no histórico de transições de coluna por qualquer tutor | M2 | R2 |
| 4 | F4: Registro de Comunicação | Registro de tentativas e envios de contato (WhatsApp, e-mail, telefone, AVA) | M2 | R2 |
| 5 | F5: Passagem de Bastão (Backend) | Endpoint `POST /api/tutoria/kanban/:id/transferir` com justificativa pedagógica | M2 | R2, R3 |
| 6 | F6: API de Linha do Tempo Consolidada | Endpoint `GET /api/tutoria/aluno/:matricula/timeline` ordenado cronologicamente | M2 | R3 |
| 7 | F7: API de Tutores Ativos | Endpoint `GET /api/tutoria/tutores` acessível por tutores para seleção de pares | M2 | R3 |
| 8 | F8: Visualização de Timeline no Modal | Componente `TutoriaTimeline` no Tab 3 do `TutoriaDashboard.tsx` | M3 | R4 |
| 9 | F9: Registro de Intervenção no Frontend | Formulário interativo `TutoriaInterventionForm` para notas rápidas | M3 | R4 |
| 10 | F10: Badge de Tutor Responsável no Kanban | Exibição visual do tutor titular em cada card do `TutoriaKanbanClient.tsx` | M4 | R4 |
| 11 | F11: Indicador de Intervenção Recente | Destaque visual (pulse badge) em cards com atividade nas últimas 48h | M4 | R4 |
| 12 | F12: Modal de Passagem de Bastão | Diálogo `BatonPassDialog` permitindo transferência com notas e atualização em tempo real | M4 | R4 |
| 13 | F13: Movimentação Kanban Preservando Posse | Drag-and-drop preserva titularidade e grava histórico com autor correto | M4 | R4 |
| 14 | F14: Migrações Idempotentes e Boot | Script `migrate-tutoria-multitutor.ts` e hook `ensureTimelineTable()` | M1 | R2 |
| 15 | F15: Monorepo Build & Lint Limpo | Correção de lint no backend/frontend, tipagem e build sem falhas | M5 | Acceptance |
| 16 | F16: E2E Verification & Hardening | Validação 100% dos testes E2E (Tiers 1-4) e cobertura adversarial (Tier 5) | M6 | Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Schema & Migrations | Drizzle schema `tutoriaAtendimentosHistorico`, colunas adicionais em `tutoriaAtendimentosKanban`, migration script `migrate-tutoria-multitutor.ts`, e hook `ensureTimelineTable()` em `TutoriaService` | none | DONE |
| M2 | Backend Tutoria APIs & Hybrid Ownership | DTOs, refatoração de `updateKanbanCard`, endpoints de intervenção, passagem de bastão, timeline consolidada e listagem de tutores em `TutoriaController` e `TutoriaService` com testes unitários | M1 | DONE |
| M3 | Frontend Timeline & Interventions UI | Criação de `TutoriaTimeline.tsx`, `TutoriaInterventionForm.tsx`, Server Actions em `actions/tutoria.ts`, integração na Tab 3 do `TutoriaDashboard.tsx` | M2 | DONE |
| M4 | Frontend Kanban Multi-Tutor & Baton Pass UI | Criação de `BatonPassDialog.tsx`, badges de tutor titular e pulso de atividade recente nos cards de `TutoriaKanbanClient.tsx`, modal de edição atualizado com ação de transferir bastão | M2, M3 | DONE |
| M5 | Build, Lint & Monorepo Hardening | Correção de lint em `student-session.guard.spec.ts`, `TutoriaDashboard.tsx`, `Topbar.tsx`, ajuste para build offline sem erros de fontes, validação do build completo do monorepo | M3, M4 | DONE |
| M6 | Final Milestone: E2E Test Suite & Hardening | Execução e validação de 100% da suíte de testes E2E (Tiers 1-4) e hardening adversarial (Tier 5) com publicação de `TEST_READY.md` e verificação final | M1, M2, M3, M4, M5, E2E Track | DONE |

## Interface Contracts

### Backend ↔ Frontend API Endpoints
1. `GET /api/tutoria/aluno/:matricula/timeline`
   - **Auth**: Bearer JWT (`@RequireModule('tutoria')`)
   - **Params**: `matricula: string`
   - **Query**: `?atendimentoId=string` (opcional)
   - **Response**: `200 OK`
     ```json
     [
       {
         "id": "uuid",
         "atendimentoId": "uuid",
         "matricula": "string",
         "periodo": "string",
         "tipoEvento": "abertura | mudanca_status | contato_enviado | intervencao_manual | passagem_bastao | finalizacao | reabertura",
         "autorId": "uuid",
         "autorNome": "string",
         "tutorResponsavelAnteriorId": "uuid | null",
         "tutorResponsavelNovoId": "uuid | null",
         "estadoAnterior": "string | null",
         "estadoNovo": "string | null",
         "canalContato": "whatsapp | email | telefone | ava | outro | null",
         "observacoes": "string | null",
         "metadata": "object | null",
         "createdAt": "ISO-8601 string"
       }
     ]
     ```

2. `POST /api/tutoria/intervencoes`
   - **Auth**: Bearer JWT (`@RequireModule('tutoria')`)
   - **Body**:
     ```json
     {
       "atendimentoId": "string (optional)",
       "matricula": "string",
       "periodo": "string (optional)",
       "tipoEvento": "intervencao_manual | contato_enviado",
       "canalContato": "whatsapp | email | telefone | ava | outro (optional)",
       "observacoes": "string",
       "statusKanban": "string (optional)",
       "metadata": "object (optional)"
     }
     ```
   - **Response**: `201 Created` — Retorna o evento inserido na timeline.

3. `POST /api/tutoria/kanban/:id/transferir`
   - **Auth**: Bearer JWT (`@RequireModule('tutoria')`)
   - **Params**: `id: string` (atendimentoId)
   - **Body**:
     ```json
     {
       "novoTutorId": "string (UUID)",
       "notaTransicao": "string"
     }
     ```
   - **Response**: `200 OK` — Retorna `{ success: true, card: UpdatedCard, evento: TimelineEvent }`.

4. `GET /api/tutoria/tutores`
   - **Auth**: Bearer JWT (`@RequireModule('tutoria')`)
   - **Response**: `200 OK`
     ```json
     [
       {
         "id": "uuid",
         "name": "string",
         "email": "string"
       }
     ]
     ```

5. `PATCH /api/tutoria/kanban/:id`
   - **Behavior**: Preserves `tutor_responsavel_id` unless explicit transfer requested. Inserts audit event for status change or note update with acting user details.

## Code Layout
- Backend:
  - `apps/backend/src/db/schema.ts` — Drizzle schema definition
  - `apps/backend/src/db/migrate-tutoria-multitutor.ts` — Idempotent migration script
  - `apps/backend/src/tutoria/dto/create-intervencao.dto.ts` — DTO for interventions
  - `apps/backend/src/tutoria/dto/transferir-tutor.dto.ts` — DTO for baton pass
  - `apps/backend/src/tutoria/tutoria.controller.ts` — Controller routes
  - `apps/backend/src/tutoria/tutoria.service.ts` — Service logic and audit trail logger
  - `apps/backend/src/tutoria/tutoria.service.spec.ts` — Unit tests
  - `apps/backend/test/tutoria.e2e-spec.ts` — Isolated E2E test suite
- Frontend:
  - `apps/frontend/src/app/actions/tutoria.ts` — Server actions for API integration
  - `apps/frontend/src/components/tutoria/TutoriaTimeline.tsx` — Timeline presentation component
  - `apps/frontend/src/components/tutoria/TutoriaInterventionForm.tsx` — Intervention form
  - `apps/frontend/src/components/tutoria/BatonPassDialog.tsx` — Baton pass modal dialog
  - `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx` — Student details modal (Tab 3 integration)
  - `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx` — Kanban card enhancements & baton pass action
