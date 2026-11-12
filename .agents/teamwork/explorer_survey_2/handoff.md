# Handoff Report — Explorer Survey 2: Frontend Architecture & UI/UX

## 1. Observation

Direct investigation of `apps/frontend` and its integration with `apps/backend` revealed the following exact locations, structures, and baseline states:

### 1.1 Page Entrypoints and Session User Propagation
- **`/tutoria` Page** (`apps/frontend/src/app/tutoria/page.tsx:11-45`):
  - NextAuth session is retrieved on the server via `await auth()` (`apps/frontend/src/auth.ts:4-79`).
  - Access control verifies `session.user.isSuperAdmin` or module presence (`tutoria`).
  - Serializes `safeSessionUser` and injects it into `TutoriaDashboard`:
    ```typescript
    // apps/frontend/src/app/tutoria/page.tsx:34-44
    const safeSessionUser = {
      id: String(session.user.id || ""),
      name: String(session.user.name || ""),
      email: String(session.user.email || ""),
      isSuperAdmin: !!(session.user as any)?.isSuperAdmin,
    }
    return (
      <div className="space-y-6">
        <TutoriaDashboard sessionUser={safeSessionUser} />
      </div>
    )
    ```
- **`/tutoria/kanban` Page** (`apps/frontend/src/app/tutoria/kanban/page.tsx:11-45`):
  - Identical auth validation and safe user serialization passed to `<TutoriaKanbanClient sessionUser={safeSessionUser} />`.

### 1.2 Student Details Drawer/Modal in `TutoriaDashboard.tsx`
- File: `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx:1292-1898`.
- Modal is conditionally rendered when `selectedStudent` is non-null.
- Modal structure comprises:
  - Header (`lines 1296-1345`): displays student name, matricula, email, discipline, course, polo, risk badge, and kanban status badge.
  - Tabs Navigation (`lines 1348-1387`):
    - Tab 1: `acolhimento` ("Acolhimento & WhatsApp") — contains Kanban Stepper (`lines 1393-1464`), pedagogical template switcher (`lines 1493-1541`), and action triggers for WhatsApp, Email, and Kanban creation (`lines 1544-1633`).
    - Tab 2: `diagnostico` ("Diagnóstico AVA & Materiais") — displays KPI metrics and list of accessed course units/modules (`studentLogs`).
    - Tab 3: `historico` ("Histórico & Tutoria", `lines 1782-1879`):
      - Currently only displays a static 2-column grid:
        - "Status Atual da Intervenção": Kanban status, Tutor Responsável (`selectedStudent.kanban_tutor_nome`), Last contact date, Channel, Resolution date.
        - "Gestão de Carteira": Button to mark as Evadido/Não Localizado, or Reativar, plus a link to `/tutoria/kanban`.
      - **Critical Gap**: There is **no chronological timeline**, **no history of interventions or communications from other tutors**, **no form to register collaborative interventions**, and **no action to transfer attendance ownership (passagem de bastão)**.

### 1.3 Kanban Board and Card Structure in `TutoriaKanbanClient.tsx`
- File: `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx`.
- Columns (`lines 53-99`): `pendente`, `em_contato`, `em_recuperacao`, `revertido`, `evadido`.
- HTML5 Drag and Drop (`lines 433-447`):
  - `handleDragStart`, `handleDragOver`, `handleDrop` invokes `handleMoveCard(cardId, targetStatus)`.
- Card Rendering (`lines 1075-1205`):
  - Displays: student name, matricula, risk badge, discipline, course, polo, total AVA time, quick observations, WhatsApp button, and column shift buttons (`ChevronLeft`/`ChevronRight`).
  - **Critical Gap 1**: Does NOT display the **primary responsible tutor badge** (`card.tutor_nome`).
  - **Critical Gap 2**: Does NOT display any **recent intervention indicator** (e.g. contact/action within the last 24h, 48h, or 7 days).
- Card Edit Modal (`lines 1211-1355`):
  - Allows changing column status, contact channel, and observations text.
  - **Critical Gap 3**: Does NOT provide a "Passar Bastão" (transfer ownership) action with transition notes, nor does it display the multi-tutor history.

### 1.4 API Client & Server Actions
- Server actions are defined in `apps/frontend/src/app/actions/tutoria.ts:1-261`.
- Calls to the NestJS backend route through `fetchFromApi` (`apps/frontend/src/app/actions/api.ts:5-48`), which automatically injects:
  `Authorization: Bearer ${session.user.accessToken}`.
- Backend `JwtAuthGuard` (`apps/backend/src/auth/jwt-auth.guard.ts:49-100`) extracts `payload.sub` and assigns `req.user = { id: payload.sub, email: payload.email, ... }`.
- Backend `TutoriaController` (`apps/backend/src/tutoria/tutoria.controller.ts:98-111`) receives `req.user.id`.
- **Backend Ownership Overwrite Bug**: In `apps/backend/src/tutoria/tutoria.service.ts:761-770`, `updateKanbanCard` currently forces `tutor_responsavel_id = tutorId` whenever any update is made by an authenticated user. This breaks multi-tutor hybrid ownership (collaborating tutors inadvertently overwrite the primary tutor on column movement or note updates).
- **Missing Tutors Lookup**: `apps/backend/src/users/users.controller.ts:17-29` is guarded by `@RequireAdmin()`. Non-admin tutors cannot fetch users from `/api/users`. Thus, `TutoriaModule` requires a dedicated endpoint (`GET /api/tutoria/tutores`) accessible to tutors.

### 1.5 Baseline Build and Typing Verification
- Command: `npx tsc --noEmit --project apps/frontend/tsconfig.json`
- Result: **0 errors**, completed with exit code 0.
- Installed frontend libraries (`apps/frontend/package.json`): React 19.2.4, Next.js 16.2.6, Tailwind CSS v4, `@base-ui/react` ^1.5.0, `lucide-react` ^1.16.0, `clsx`, `tailwind-merge`.

---

## 2. Logic Chain

1. **Premise (R1 & R4)**: The system requires a hybrid multi-tutor ownership model where each discente has a single primary tutor responsible, while allowing other tutors to perform interventions, send communications, and explicitly transfer ownership (baton pass) with transition notes.
2. **Current State Observation (1.2 & 1.3)**:
   - Neither `TutoriaDashboard.tsx` nor `TutoriaKanbanClient.tsx` possesses a timeline component or baton pass modal.
   - Kanban cards omit the primary tutor badge and recent intervention status.
   - Dragging a card triggers `updateTutoriaKanbanCard`, which currently has no audit trail and inappropriately reassigns primary ownership.
3. **Identity & Context Chain (1.1 & 1.4)**:
   - The logged-in tutor identity (`sessionUser = { id, name, email }`) is already safely wired into both pages.
   - All server actions automatically pass the user's JWT Bearer token to NestJS.
   - Therefore, no changes to the NextAuth architecture or session hydration are required; the frontend can directly compare `sessionUser.id` with `card.tutor_responsavel_id` to determine "Você" vs "Outro Tutor".
4. **Architectural Separation**:
   - Creating a modular timeline component (`apps/frontend/src/components/tutoria/TutoriaTimeline.tsx`) and a baton pass modal (`apps/frontend/src/components/tutoria/BatonPassDialog.tsx`) allows reuse between both `TutoriaDashboard.tsx` (the student details modal) and `TutoriaKanbanClient.tsx` (the kanban card modal).
5. **Server Actions Specification**:
   - The frontend needs four clean actions in `apps/frontend/src/app/actions/tutoria.ts`:
     - `getTutoriaTimeline(matricula: string)`
     - `createTutoriaIntervention(data: CreateInterventionInput)`
     - `transferTutoriaOwnership(cardId: string, data: TransferOwnershipInput)`
     - `getTutoriaTutores()`

---

## 3. UI/UX Component Specifications

### 3.1 Chronological Timeline Component (`TutoriaTimeline.tsx`)
- **Path**: `apps/frontend/src/components/tutoria/TutoriaTimeline.tsx`
- **Data Model**:
  ```typescript
  export type TimelineEventType =
    | 'abertura'
    | 'mudanca_status'
    | 'comunicacao'
    | 'intervencao'
    | 'passagem_bastao'
    | 'finalizacao'
    | 'reabertura'

  export interface TimelineEvent {
    id: string
    atendimentoId?: string | null
    matricula: string
    tutorId: string
    tutorNome: string
    tutorEmail?: string | null
    tipoEvento: TimelineEventType
    statusAnterior?: string | null
    statusNovo?: string | null
    tutorAnteriorId?: string | null
    tutorAnteriorNome?: string | null
    tutorNovoId?: string | null
    tutorNovoNome?: string | null
    canal?: 'whatsapp' | 'email' | 'telefone' | 'ava_mensagem' | 'outro' | null
    conteudo?: string | null
    dataHora: string // ISO 8601
  }
  ```
- **Visual Design**:
  - Vertical timeline layout with a connecting gradient line (`border-l-2 border-indigo-100`).
  - Distinct colored badges and Lucide icons per event type:
    | `tipoEvento` | Icon | Badge Style | Description |
    |---|---|---|---|
    | `abertura` | `PlusCircle` / `Kanban` | Blue (`bg-blue-50 text-blue-700`) | Atendimento iniciado no Kanban |
    | `mudanca_status` | `ArrowRight` | Purple (`bg-purple-50 text-purple-700`) | Avanço de coluna (ex: A Contatar → Em Contato) |
    | `comunicacao` | `MessageCircle` / `Mail` | Emerald (`bg-emerald-50 text-emerald-700`) | Mensagem WhatsApp / E-mail disparada |
    | `intervencao` | `FileText` / `Activity` | Indigo (`bg-indigo-50 text-indigo-700`) | Anotação pedagógica / intervenção |
    | `passagem_bastao` | `ArrowRightLeft` / `Users` | Amber (`bg-amber-50 text-amber-700`) | Passagem de bastão entre tutores |
    | `finalizacao` | `CheckCircle2` | Teal (`bg-teal-50 text-teal-700`) | Atendimento regularizado/concluído |
    | `reabertura` | `RefreshCw` | Slate (`bg-slate-100 text-slate-700`) | Atendimento reativado |
  - Tutor tag: highlights `Você` if `tutorId === sessionUser.id`, `Tutor Titular` if matching primary owner, or `Tutor Colaborador`.
  - Date/time format: `dd/MM/yyyy às HH:mm` with relative badge (e.g. "há 2 horas").
  - Quotation card for notes and transition justifications.

### 3.2 Register Intervention Form (`TutoriaInterventionForm.tsx`)
- Placed directly inside Tab 3 of the Student Details Modal.
- Allows any tutor viewing the student to register an intervention or contact note:
  - Textarea: notes / pedagogical diagnosis.
  - Channel selector: WhatsApp, E-mail, Telefone, AVA, Reunião.
  - Optional checkbox: "Avançar discente para a próxima etapa do Kanban".
  - Submit button with optimistic state update and instant timeline prepend.

### 3.3 Baton Pass Dialog (`BatonPassDialog.tsx`)
- **Path**: `apps/frontend/src/components/tutoria/BatonPassDialog.tsx`
- **Modal Dialog**:
  - Header: "Passagem de Bastão — Transferência de Tutoria"
  - Student summary: Nome, Matrícula, Disciplina, Tutor Titular Atual.
  - Tutor selector: `<select>` populated from `getTutoriaTutores()` listing active tutors.
  - Transition note: `<textarea>` requiring explanation (e.g., student availability, special pedagogical need).
  - Confirm button: invokes `transferTutoriaOwnership(cardId, { novoTutorId, motivo })`.
  - UI feedback: updates `kanban_tutor_nome` on the student and card immediately, logs the event to the timeline, and displays a success toast.

### 3.4 Kanban Card UI Enhancements (`TutoriaKanbanClient.tsx`)
- **Primary Tutor Badge**:
  - Inserted into card footer:
    ```tsx
    <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-gray-100">
      <div className="flex items-center gap-1.5 text-gray-600 truncate">
        <UserCheck className={`w-3.5 h-3.5 shrink-0 ${card.tutor_responsavel_id === sessionUser?.id ? 'text-indigo-600' : 'text-gray-400'}`} />
        <span className="font-medium text-gray-500">Tutor:</span>
        <span className={`font-semibold truncate ${card.tutor_responsavel_id === sessionUser?.id ? 'text-indigo-700 bg-indigo-50 px-1 rounded' : 'text-gray-800'}`}>
          {card.tutor_responsavel_id === sessionUser?.id ? 'Você' : (card.tutor_nome || 'Não atribuído')}
        </span>
      </div>
    </div>
    ```
- **Recent Intervention Indicator**:
  - Highlighted badge when `ultimo_contato_em` or `ultima_intervencao_em` was updated within the last 48 hours:
    ```tsx
    {isRecentIntervention && (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Intervenção recente
      </span>
    )}
    ```
- **Column Move History Preservation**:
  - Moving cards preserves `tutor_responsavel_id`.
  - The moving user's identity is recorded automatically in the audit trail without altering ownership.

---

## 4. Caveats

1. **Backend Dependency**: Full timeline display and baton pass execution depend on the backend creating the audit trail table (`tutoria_atendimentos_timeline` or `tutoria_atendimentos_historico`) and endpoints (`GET /api/tutoria/aluno/:matricula/timeline`, `POST /api/tutoria/intervencoes`, `POST /api/tutoria/kanban/:id/transferir`, `GET /api/tutoria/tutores`).
2. **Mocking / Fallback Strategy**: During development before the backend endpoints are deployed, frontend server actions can provide safe fallbacks (returning empty arrays or mock timeline entries) to maintain uninterrupted frontend build and render stability.
3. **No Caveats on UI Components**: All required UI primitives (`dialog.tsx`, `avatar.tsx`, `badge.tsx`, `button.tsx`, `select.tsx`, `textarea.tsx`, Lucide icons) are already present and fully compatible with React 19 and Tailwind CSS v4 in `apps/frontend`.

---

## 5. Conclusion

1. The frontend codebase is well-structured and possesses clean entrypoints for `/tutoria` and `/tutoria/kanban` with `sessionUser` already available in component props.
2. The UI gaps are clearly defined and localized:
   - In `TutoriaDashboard.tsx`, replace the static Tab 3 content with `TutoriaTimeline` and an intervention registration form.
   - In `TutoriaKanbanClient.tsx`, add the primary tutor badge and recent intervention pulse to cards, and add the "Passar Bastão" action to the card modal.
   - In `apps/frontend/src/app/actions/tutoria.ts`, add server actions for timeline retrieval, intervention creation, ownership transfer, and tutor listing.
3. Implementing these components modularly in `apps/frontend/src/components/tutoria/` ensures clean reusability across both dashboard and kanban views with zero regression risk to existing Moodle sync or metrics workflows.

---

## 6. Verification Method

To verify these findings and future implementation independently:

1. **Typecheck Frontend**:
   ```pwsh
   npx tsc --noEmit --project apps\frontend\tsconfig.json
   ```
   *Expected result*: 0 errors.

2. **Frontend Production Build**:
   ```pwsh
   npm run build --filter=@nexus-core/frontend
   ```
   *Expected result*: Successful build of all Next.js routes including `/tutoria` and `/tutoria/kanban`.

3. **Visual & Interaction Spot Checks**:
   - Inspect `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx` at line 1782 to verify Tab 3 ("Histórico & Tutoria") integration.
   - Inspect `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx` at line 1094 to verify primary tutor badge and intervention indicator on cards.
   - Confirm `BatonPassDialog` properly renders available tutors and transfers ownership with transition notes.
