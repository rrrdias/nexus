# Scope: Milestone 4 (Frontend Kanban Multi-Tutor & Baton Pass UI)

## Architecture
- **Monorepo**: Turborepo workspace `apps/frontend` (Next.js 16, React 19, Tailwind CSS v4, Base UI, Lucide icons).
- **Domain**: Tutoria Kanban Board Multi-Tutor Ownership, Baton Pass Modal & Recent Activity Visuals.
- **Components**:
  - `apps/frontend/src/components/tutoria/BatonPassDialog.tsx`: Modal dialog for selecting an active tutor from `getTutoresAtivos()` / `getTutoriaTutores()`, inputting a mandatory transition note (>= 5 chars), and executing `transferirTutoriaBastao(cardId, { novoTutorId, notaTransicao })`.
  - `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx`:
    - Kanban cards: visual badge for lead responsible tutor (`tutorResponsavelNome` / `tutor_nome`).
    - Recent activity indicator: pulsing indicator/badge for cards with intervention/activity in the last 48 hours (`ultimaIntervencaoEm` / `qtdIntervencoes`).
    - Quick action / button to trigger the Baton Pass dialog directly from each card or within card details/modal.
    - Drag-and-drop column transition: ensures calling `updateKanbanCardStatus` preserves lead tutor ownership while automatically recording audit trail with the acting tutor's credentials.

## Feature Inventory (Milestone 4)
| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| 10 | F10: Badge de Tutor Responsável no Kanban | Exibição visual do tutor titular em cada card do `TutoriaKanbanClient.tsx` | M4 | DONE |
| 11 | F11: Indicador de Intervenção Recente | Destaque visual (pulse badge) em cards com atividade nas últimas 48h | M4 | DONE |
| 12 | F12: Modal de Passagem de Bastão | Diálogo `BatonPassDialog` permitindo transferência com notas e atualização em tempo real | M4 | DONE |
| 13 | F13: Movimentação Kanban Preservando Posse | Drag-and-drop preserva titularidade e grava histórico com autor correto | M4 | DONE |

## Interface Contracts
- Server Actions consumed:
  - `getTutoresAtivos()` / `getTutoriaTutores()`: returns `{ success: true, tutores: ActiveTutor[] }`
  - `transferirTutoriaBastao(id: string, data: { novoTutorId: string; notaTransicao: string })`: returns `{ success: true, card, evento }`
  - `updateKanbanCard(id: string, data: ...)` or `updateKanbanCardStatus(id: string, status: string)`: updates column while preserving `tutor_responsavel_id`

## Code Layout & Write Boundaries
- Exclusive write ownership for Worker:
  - `apps/frontend/src/components/tutoria/BatonPassDialog.tsx`
  - `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx`
- Read-only reference:
  - `apps/frontend/src/app/actions/tutoria.ts`
  - `apps/frontend/src/components/tutoria/TutoriaTimeline.tsx`
  - `apps/frontend/src/components/tutoria/TutoriaInterventionForm.tsx`
  - `apps/backend/src/tutoria/*`
