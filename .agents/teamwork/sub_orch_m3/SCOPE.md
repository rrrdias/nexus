# Scope: Milestone 3 (Frontend Timeline & Interventions UI)

## Architecture
- **Monorepo**: Turborepo workspace `apps/frontend` (Next.js 16, React 19, Tailwind CSS v4, Base UI, Lucide icons).
- **Domain**: Tutoria Multi-Tutor Hybrid Attendance, Timeline & Interventions UI.
- **Server Actions**: `apps/frontend/src/app/actions/tutoria.ts` using `fetchFromApi` to communicate with backend APIs with Bearer token authentication.
- **Components**:
  - `apps/frontend/src/components/tutoria/TutoriaTimeline.tsx`: Chronological vertical timeline rendering lifecycle events (`abertura`, `mudanca_status`, `contato_enviado`, `intervencao_manual`, `passagem_bastao`, `finalizacao`, `reabertura`).
  - `apps/frontend/src/components/tutoria/TutoriaInterventionForm.tsx`: Intervention note and contact registration form with channel selection and optimistic refresh.
  - Tab 3 of `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx`: Integrated timeline and intervention form within the student details modal.

## Feature Inventory (Milestone 3)
| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| 8 | F8: Visualização de Timeline no Modal | Componente TutoriaTimeline no Tab 3 do TutoriaDashboard.tsx | M3 | IN_PROGRESS |
| 9 | F9: Registro de Intervenção no Frontend | Formulário interativo TutoriaInterventionForm para notas rápidas | M3 | IN_PROGRESS |
| - | Server Actions Tutoria | `getTutoriaTimeline`, `createTutoriaIntervention`, `getTutoriaTutores` em `actions/tutoria.ts` | M3 | IN_PROGRESS |

## Interface Contracts

### Backend Endpoints Consumed
1. `GET /api/tutoria/aluno/:matricula/timeline`
   - Response: array of timeline events (`id`, `atendimentoId`, `matricula`, `periodo`, `tipoEvento`, `autorId`, `autorNome`, `tutorResponsavelAnteriorId`, `tutorResponsavelNovoId`, `estadoAnterior`, `estadoNovo`, `canalContato`, `observacoes`, `metadata`, `createdAt`).
2. `POST /api/tutoria/intervencoes`
   - Body: `{ matricula: string, tipoEvento: "intervencao_manual" | "contato_enviado", canalContato?: string, observacoes: string, atendimentoId?: string, periodo?: string, statusKanban?: string, metadata?: object }`
   - Response: 201 Created (the created timeline event).
3. `GET /api/tutoria/tutores`
   - Response: array of `{ id: string, name: string, email: string }`.

### Server Actions Signatures (`apps/frontend/src/app/actions/tutoria.ts`)
- `getTutoriaTimeline(matricula: string, atendimentoId?: string): Promise<{ success: boolean; data?: TimelineEvent[]; error?: string }>`
- `createTutoriaIntervention(data: CreateInterventionInput): Promise<{ success: boolean; data?: TimelineEvent; error?: string }>`
- `getTutoriaTutores(): Promise<{ success: boolean; data?: { id: string; name: string; email: string }[]; error?: string }>`

### Component Specifications
1. `TutoriaTimeline.tsx`:
   - Props: `events: TimelineEvent[]`, `sessionUser?: { id?: string; name?: string; email?: string }`, `currentTutorId?: string | null`, `isLoading?: boolean`, `onRefresh?: () => void`.
   - Event types handling: `abertura`, `mudanca_status`, `contato_enviado`, `intervencao_manual`, `passagem_bastao`, `finalizacao`, `reabertura` (and fallback for `comunicacao`/`intervencao`).
   - Relative timestamps and absolute timestamps.
   - Author tags: "Você", "Tutor Titular", "Tutor Colaborador".
2. `TutoriaInterventionForm.tsx`:
   - Props: `matricula: string`, `atendimentoId?: string | null`, `periodo?: string | null`, `currentStatus?: string | null`, `onSuccess?: (newEvent?: any) => void`.
   - Channels: WhatsApp, E-mail, Telefone, AVA, Reunião, Outro.
3. `TutoriaDashboard.tsx` (Tab 3 Integration):
   - Replace static cards with:
     - Header summary showing student info, primary responsible tutor, and quick intervention trigger.
     - `TutoriaInterventionForm` component.
     - `TutoriaTimeline` component fetching and rendering timeline events for `selectedStudent.matricula`.

## Code Layout & Write Boundaries
- Exclusive write ownership for Worker:
  - `apps/frontend/src/app/actions/tutoria.ts`
  - `apps/frontend/src/components/tutoria/TutoriaTimeline.tsx`
  - `apps/frontend/src/components/tutoria/TutoriaInterventionForm.tsx`
  - `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx`
- Read-only reference:
  - `apps/frontend/src/app/actions/api.ts`
  - `apps/frontend/src/app/tutoria/page.tsx`
  - `apps/frontend/src/components/tutoria/*`
  - `apps/backend/src/tutoria/*`
